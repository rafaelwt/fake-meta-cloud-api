const { inboundMessageModel } = require('../database/models');
const { sendWebhook } = require('./webhookService');
const tenantService = require('./tenantService');

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

  const tenant = tenantService.tenantForPhone(wabaId);
  const payload = buildInboundPayload({
    tenant,
    id: messageId,
    from: fromId,
    name: inbound.name || fromId,
    timestamp: stored.received_at.toString(),
    body: inbound.text.body
  });

  // Inbound webhooks are not tied to an outbound message, so they are not logged as events
  sendWebhook(tenant.webhook_url, payload, messageId, 'message', { logEvent: false, appSecret: tenant.app_secret });

  return {
    messaging_product: 'whatsapp',
    messages: [{ id: messageId }]
  };
}

/**
 * Build webhook payload for an inbound text message
 * @param {object} message - tenant, id, from, name, timestamp, body
 * @returns {object} - Webhook payload
 */
function buildInboundPayload(message) {
  const { tenant } = message;

  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: tenant.waba_id,
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: tenant.display_phone_number,
            phone_number_id: tenant.phone_number_id
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

/**
 * Mark an inbound message as read (optionally with typing indicator)
 * @param {string} messageId - Inbound message ID
 * @returns {boolean} - False if the message does not exist
 */
function markAsRead(messageId) {
  return Boolean(inboundMessageModel.findById(messageId));
}

module.exports = {
  processInbound,
  markAsRead,
  buildInboundPayload
};
