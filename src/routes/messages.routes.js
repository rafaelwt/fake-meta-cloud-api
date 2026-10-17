const messageRequestSchema = require('../schemas/messageRequest.schema');

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
   * Send a WhatsApp message
   */
  fastify.post(`/${VERSION}/:wabaId/messages`, {
    schema: {
      body: messageRequestSchema,
      params: {
        type: 'object',
        properties: {
          version: { type: 'string' },
          wabaId: { type: 'string' }
        },
        required: ['version', 'wabaId']
      }
    },
    preHandler: auth
  }, handlers.sendMessage);

  /**
   * GET /:version/:wabaId/messages/stats
   * Get message statistics (debugging)
   */
  fastify.get(`/${VERSION}/:wabaId/messages/stats`, {
    preHandler: auth
  }, handlers.getStats);

  /**
   * GET /:version/:wabaId/webhooks/events
   * Get webhook events (debugging)
   */
  fastify.get(`/${VERSION}/:wabaId/webhooks/events`, {
    preHandler: auth
  }, handlers.getWebhookEvents);
}

module.exports = messagesRoutes;
