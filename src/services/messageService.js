const { messageModel } = require('../database/models');
const { startMessageFlow } = require('../events/emitter');
const { shouldTriggerError } = require('../utils/errorPatterns');
const config = require('../config');

/**
 * Process a new message and start the status flow
 * @param {object} message - Message from request
 * @param {string} messageId - Generated message ID
 * @param {string} wabaId - WhatsApp Business Account ID
 * @returns {object} - Immediate response
 */
function processMessage(message, messageId, wabaId) {
  const recipientId = message.to.replace('+', '');

  // Check if should trigger error
  const errorCode = shouldTriggerError(message.to, config.errors.patterns);

  // Save to database
  messageModel.insert({
    id: messageId,
    waba_id: wabaId,
    recipient_id: recipientId,
    message_type: message.type,
    message_content: message
  });

  // Start async webhook flow
  const messageData = {
    id: messageId,
    recipient_id: recipientId,
    type: message.type,
    template_name: message.template?.name
  };
  startMessageFlow(messageData, config.webhook.url, errorCode);

  // Return immediate response
  return {
    messaging_product: 'whatsapp',
    contacts: [{ input: message.to, wa_id: recipientId }],
    messages: [{ id: messageId, message_status: 'accepted' }]
  };
}

/**
 * Get message statistics
 */
function getMessageStats() {
  const recent = messageModel.getRecent(100);
  return {
    total_messages: recent.length,
    by_status: recent.reduce((acc, msg) => {
      acc[msg.status] = (acc[msg.status] || 0) + 1;
      return acc;
    }, {}),
    by_type: recent.reduce((acc, msg) => {
      acc[msg.message_type] = (acc[msg.message_type] || 0) + 1;
      return acc;
    }, {})
  };
}

/**
 * Get webhook events by message ID
 */
function getWebhookEventsByMessage(messageId) {
  const { webhookEventModel } = require('../database/models');
  return webhookEventModel.getByMessageId(messageId);
}

/**
 * Get recent webhook events
 */
function getRecentWebhookEvents(limit = 50) {
  const { webhookEventModel } = require('../database/models');
  return webhookEventModel.getRecent(limit);
}

module.exports = {
  processMessage,
  getMessageStats,
  getWebhookEventsByMessage,
  getRecentWebhookEvents
};
