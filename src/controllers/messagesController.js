const IdGenerator = require('../utils/idGenerator');
const messageService = require('../services/messageService');
const inboundService = require('../services/inboundService');
const { metaError } = require('../utils/metaError');
const { checkSyncError, getResponseDelay } = require('../utils/syncErrors');
const config = require('../config');
const templateService = require('../services/templateService');
const tenantService = require('../services/tenantService');
const { validateTemplateSend } = require('../services/templateValidator');

/**
 * Send a WhatsApp message
 */
async function sendMessage(request, reply) {
  const { wabaId } = request.params;
  const message = request.body;

  if (message.status === 'read') {
    return markAsRead(request, reply);
  }

  request.log.info({ wabaId, type: message.type, to: message.to }, 'Received message request');

  const delay = getResponseDelay(message.to, config.errors.responseDelayPatterns);
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  const syncError = checkSyncError(message.to, config.errors.syncPatterns);
  if (syncError) {
    request.log.info({ to: message.to, code: syncError.body.error.code, status: syncError.statusCode }, 'Simulated synchronous error');
    return reply.status(syncError.statusCode).send(syncError.body);
  }

  if (message.type === 'template' && config.behavior.templateValidationEnforced) {
    const templateWabaId = tenantService.templateWabaFor(wabaId);
    const stored = templateService.findTemplate(templateWabaId, message.template.name, message.template.language.code);
    const templateError = validateTemplateSend(stored, message.template);
    if (templateError) {
      request.log.info({ templateWabaId, template: message.template.name, code: templateError.body.error.code }, 'Template message rejected');
      return reply.status(templateError.statusCode).send(templateError.body);
    }
  }

  const messageId = IdGenerator.generateWamid();
  const response = messageService.processMessage(message, messageId, wabaId);

  request.log.info({ messageId, recipient: message.to, type: message.type }, 'Message accepted');

  return response;
}

/**
 * Mark an inbound message as read (and optionally show typing indicator)
 */
async function markAsRead(request, reply) {
  const { message_id: messageId, typing_indicator: typingIndicator } = request.body;

  if (!inboundService.markAsRead(messageId)) {
    return reply.status(400).send(metaError(100, '(#100) Invalid parameter', {
      error_data: {
        messaging_product: 'whatsapp',
        details: `Message ${messageId} not found`
      }
    }));
  }

  request.log.info({ messageId, typing: Boolean(typingIndicator) }, 'Inbound message marked as read');

  return { success: true };
}

/**
 * Simulate an inbound user message (fake-only)
 */
async function simulateInbound(request, reply) {
  const { wabaId } = request.params;
  const inbound = request.body;

  const messageId = IdGenerator.generateWamid();
  const response = inboundService.processInbound(inbound, messageId, wabaId);

  request.log.info({ messageId, from: inbound.from }, 'Inbound message simulated');

  return response;
}

/**
 * Get message statistics
 */
async function getStats(request, reply) {
  return messageService.getMessageStats();
}

/**
 * Get webhook events
 */
async function getWebhookEvents(request, reply) {
  const { messageId } = request.query;

  if (messageId) {
    const events = messageService.getWebhookEventsByMessage(messageId);
    return { message_id: messageId, events };
  }

  const events = messageService.getRecentWebhookEvents();
  return { events };
}

module.exports = {
  sendMessage,
  simulateInbound,
  getStats,
  getWebhookEvents
};
