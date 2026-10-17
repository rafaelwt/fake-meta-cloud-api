const { inboundMessageModel } = require('../database/models');
const { sendWebhook } = require('./webhookService');
const config = require('../config');

/**
 * Process a simulated inbound user message
 * Stores it (opens the service window) and notifies the webhook
 * @param {object} inbound - Inbound message from request
 * @param {string} messageId - Generated message ID
 * @param {string} wabaId - WhatsApp Business Account ID
 * @returns {object} - Immediate response
 */
function processInbound(inbound, messageId, wabaId) {
  const fromId = inbound.from.replace('+', '');

  const stored = inboundMessageModel.insert({
    id: messageId,
    waba_id: wabaId,
    from_id: fromId,
    message_type: 'text',
    message_content: inbound
  });

  const payload = buildInboundPayload({
    id: messageId,
    from: fromId,
    name: inbound.name || fromId,
    timestamp: stored.received_at.toString(),
    body: inbound.text.body
  });

  // Inbound webhooks are not tied to an outbound message, so they are not logged as events
  sendWebhook(config.webhook.url, payload, messageId, 'message', { logEvent: false });

  return {
    messaging_product: 'whatsapp',
    messages: [{ id: messageId }]
  };
}

/**
 * Build webhook payload for an inbound text message
 * @param {object} message - id, from, name, timestamp, body
 * @returns {object} - Webhook payload
 */
function buildInboundPayload(message) {
  const { meta } = config;

  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: meta.wabaId,
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: meta.displayPhoneNumber,
            phone_number_id: meta.phoneNumberId
          },
          contacts: [{
            profile: { name: message.name },
            wa_id: message.from
          }],
          messages: [{
            from: message.from,
            id: message.id,
            timestamp: message.timestamp,
            type: 'text',
            text: { body: message.body }
          }]
        },
        field: 'messages'
      }]
    }]
  };
}

module.exports = {
  processInbound,
  buildInboundPayload
};
