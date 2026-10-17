const messageRequestSchema = require('../schemas/messageRequest.schema');
const inboundRequestSchema = require('../schemas/inboundRequest.schema');
const markReadRequestSchema = require('../schemas/markReadRequest.schema');

// Same endpoint sends messages or marks inbound messages as read (status: 'read')
const messagesBodySchema = {
  if: {
    type: 'object',
    required: ['status'],
    properties: { status: { const: 'read' } }
  },
  then: markReadRequestSchema,
  else: messageRequestSchema
};

// Accept any Graph API version prefix (e.g. v19.0, v26.0), like the real API
const VERSION = ':version(^v\\d+\\.\\d+$)';

/**
 * Messages Routes
 * Defines HTTP endpoints and connects to controller handlers
 */
async function messagesRoutes(fastify, options) {
  const { handlers, auth } = options;

  /**
   * POST /:version/:wabaId/messages
   * Send a WhatsApp message, or mark an inbound message as read
   */
  fastify.post(`/${VERSION}/:wabaId/messages`, {
    schema: {
      body: messagesBodySchema,
      params: {
        type: 'object',
        properties: {
          version: { type: 'string' },
          wabaId: { type: 'string' }
        },
        required: ['version', 'wabaId']
      }
    },
    onRequest: auth
  }, handlers.sendMessage);

  /**
   * GET /:version/:wabaId/messages/stats
   * Get message statistics (debugging)
   */
  fastify.get(`/${VERSION}/:wabaId/messages/stats`, {
    onRequest: auth
  }, handlers.getStats);

  /**
   * GET /:version/:wabaId/webhooks/events
   * Get webhook events (debugging)
   */
  fastify.get(`/${VERSION}/:wabaId/webhooks/events`, {
    onRequest: auth
  }, handlers.getWebhookEvents);

  /**
   * POST /:version/:wabaId/simulate/inbound
   * Simulate a user message to the business (fake-only, opens the service window)
   */
  fastify.post(`/${VERSION}/:wabaId/simulate/inbound`, {
    schema: {
      body: inboundRequestSchema
    },
    onRequest: auth
  }, handlers.simulateInbound);
}

module.exports = messagesRoutes;
