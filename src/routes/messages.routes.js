const messageRequestSchema = require('../schemas/messageRequest.schema');

/**
 * Messages Routes
 * Defines HTTP endpoints and connects to controller handlers
 */
async function messagesRoutes(fastify, options) {
  const { handlers, auth } = options;

  /**
   * POST /:wabaId/messages
   * Send a WhatsApp message
   */
  fastify.post('/v19.0/:wabaId/messages', {
    schema: {
      body: messageRequestSchema,
      params: {
        type: 'object',
        properties: {
          wabaId: { type: 'string' }
        },
        required: ['wabaId']
      }
    },
    preHandler: auth
  }, handlers.sendMessage);

  /**
   * GET /:wabaId/messages/stats
   * Get message statistics (debugging)
   */
  fastify.get('/v19.0/:wabaId/messages/stats', {
    preHandler: auth
  }, handlers.getStats);

  /**
   * GET /:wabaId/webhooks/events
   * Get webhook events (debugging)
   */
  fastify.get('/v19.0/:wabaId/webhooks/events', {
    preHandler: auth
  }, handlers.getWebhookEvents);
}

module.exports = messagesRoutes;
