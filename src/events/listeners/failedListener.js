const eventBus = require('../bus');
const { messageModel } = require('../../database/models');
const { sendWebhook } = require('../../services/webhookService');
const { buildWebhookPayload } = require('../emitter');
const { getErrorByCode } = require('../../config/errorCodes');
const logger = require('../../logger');

/**
 * FAILED Status Listener
 * Auto-registers on import
 */
eventBus.on('status:failed', async (messageData, webhookUrl, errorCode) => {
  logger.info({ messageId: messageData.id, errorCode }, 'Processing FAILED status');

  const errorDetails = getErrorByCode(errorCode);
  messageModel.markAsFailed(messageData.id, errorCode, errorDetails?.message || 'Unknown error');

  const payload = buildWebhookPayload(messageData, 'failed', errorCode);
  await sendWebhook(webhookUrl, payload, messageData.id, 'failed');
});

logger.debug('FAILED listener registered');
