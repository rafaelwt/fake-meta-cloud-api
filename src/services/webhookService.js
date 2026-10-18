const axios = require('axios');
const { webhookEventModel } = require('../database/models');
const logger = require('../logger');
const config = require('../config');
const { signPayload } = require('../utils/signature');

/**
 * Send webhook to external URL
 * @param {string} url - Webhook URL
 * @param {object} payload - Webhook payload
 * @param {string} messageId - Message ID (for logging)
 * @param {string} eventType - Event type (sent, delivered, read, failed, message)
 * @param {object} [options]
 * @param {boolean} [options.logEvent=true] - Persist to webhook_events (outbound messages only)
 * @param {string} [options.appSecret] - Secret used to sign the body (defaults to APP_SECRET)
 * @returns {Promise<object>} - Response data
 */
async function sendWebhook(url, payload, messageId, eventType, { logEvent = true, appSecret = config.meta.appSecret } = {}) {
  const startTime = Date.now();

  try {
    logger.info({
      url,
      messageId,
      eventType
    }, 'Sending webhook');

    // Serialize once so the signature matches the exact bytes sent
    const rawBody = JSON.stringify(payload);

    const response = await axios.post(url, rawBody, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-Fake-Cloud-API/1.0',
        'X-Hub-Signature-256': signPayload(rawBody, appSecret)
      },
      timeout: 10000, // 10 second timeout
      validateStatus: (status) => status >= 200 && status < 500 // Don't throw on 4xx
    });

    const duration = Date.now() - startTime;

    logger.info({
      url,
      messageId,
      eventType,
      status: response.status,
      duration
    }, 'Webhook sent successfully');

    // Log to database
    if (logEvent) webhookEventModel.log({
      message_id: messageId,
      event_type: eventType,
      webhook_url: url,
      payload: payload,
      response_status: response.status,
      response_body: JSON.stringify(response.data || {}),
      success: response.status >= 200 && response.status < 300,
      error: response.status >= 300 ? `HTTP ${response.status}` : null
    });

    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({
      url,
      messageId,
      eventType,
      error: error.message,
      duration
    }, 'Webhook delivery failed');

    // Log failure to database
    if (logEvent) webhookEventModel.log({
      message_id: messageId,
      event_type: eventType,
      webhook_url: url,
      payload: payload,
      response_status: error.response?.status || null,
      response_body: error.response?.data ? JSON.stringify(error.response.data) : null,
      success: false,
      error: error.message
    });

    // Don't throw - we log the error but don't fail the whole flow
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendWebhook
};
