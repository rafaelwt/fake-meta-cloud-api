const eventBus = require('../bus');
const { messageModel } = require('../../database/models');
const { sendWebhook } = require('../../services/webhookService');
const { buildWebhookPayload } = require('../emitter');
const logger = require('../../logger');

/**
 * SENT Status Listener
 * Auto-registers on import
 */
eventBus.on('status:sent', async (messageData, webhookUrl) => {
  logger.info({ messageId: messageData.id }, 'Processing SENT status');

  messageModel.updateStatus(messageData.id, 'sent');

  const payload = buildWebhookPayload(messageData, 'sent');
  await sendWebhook(webhookUrl, payload, messageData.id, 'sent', { appSecret: messageData.tenant?.app_secret });
});

logger.debug('SENT listener registered');
