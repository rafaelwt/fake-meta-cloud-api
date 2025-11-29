const eventBus = require('../bus');
const { messageModel } = require('../../database/models');
const { sendWebhook } = require('../../services/webhookService');
const { buildWebhookPayload } = require('../emitter');
const logger = require('../../logger');

/**
 * READ Status Listener
 * Auto-registers on import
 */
eventBus.on('status:read', async (messageData, webhookUrl) => {
  logger.info({ messageId: messageData.id }, 'Processing READ status');

  messageModel.updateStatus(messageData.id, 'read');

  const payload = buildWebhookPayload(messageData, 'read');
  await sendWebhook(webhookUrl, payload, messageData.id, 'read');
});

logger.debug('READ listener registered');
