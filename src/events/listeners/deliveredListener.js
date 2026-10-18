const eventBus = require('../bus');
const { messageModel } = require('../../database/models');
const { sendWebhook } = require('../../services/webhookService');
const { buildWebhookPayload } = require('../emitter');
const logger = require('../../logger');

/**
 * DELIVERED Status Listener
 * Auto-registers on import
 */
eventBus.on('status:delivered', async (messageData, webhookUrl) => {
  logger.info({ messageId: messageData.id }, 'Processing DELIVERED status');

  messageModel.updateStatus(messageData.id, 'delivered');

  const payload = buildWebhookPayload(messageData, 'delivered');
  await sendWebhook(webhookUrl, payload, messageData.id, 'delivered', { appSecret: messageData.tenant?.app_secret });
});

logger.debug('DELIVERED listener registered');
