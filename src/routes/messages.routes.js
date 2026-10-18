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

const versionedParams = {
  type: 'object',
  properties: {
    version: { type: 'string', examples: ['v26.0'] },
    wabaId: { type: 'string', examples: ['123456789012345'] }
  },
  required: ['version', 'wabaId']
};

const security = [{ bearerAuth: [] }];

// The path ID is a phone number: its tenant's token is required
const phoneAuth = { authScope: 'phone', authParam: 'wabaId' };

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
      tags: ['Messages'],
      summary: 'Send a message or mark one as read',
      security,
      body: messagesBodySchema,
      params: versionedParams
    },
    config: phoneAuth,
    onRequest: auth
  }, handlers.sendMessage);

  /**
   * GET /:version/:wabaId/messages/stats
   * Get message statistics (debugging)
   */
  fastify.get(`/${VERSION}/:wabaId/messages/stats`, {
    schema: {
      tags: ['Debug'],
      summary: 'Message statistics',
      security,
      params: versionedParams
    },
    config: phoneAuth,
    onRequest: auth
  }, handlers.getStats);

  /**
   * GET /:version/:wabaId/webhooks/events
   * Get webhook events (debugging)
   */
  fastify.get(`/${VERSION}/:wabaId/webhooks/events`, {
    schema: {
      tags: ['Debug'],
      summary: 'Webhook delivery log',
      security,
      params: versionedParams,
      querystring: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Only events for this wamid' }
        }
      }
    },
    config: phoneAuth,
    onRequest: auth
  }, handlers.getWebhookEvents);

  /**
   * POST /:version/:wabaId/simulate/inbound
   * Simulate a user message to the business (fake-only, opens the service window)
   */
  fastify.post(`/${VERSION}/:wabaId/simulate/inbound`, {
    schema: {
      tags: ['Simulation'],
      summary: 'Simulate a user message (opens the 24h window)',
      security,
      params: versionedParams,
      body: inboundRequestSchema
    },
    config: phoneAuth,
    onRequest: auth
  }, handlers.simulateInbound);
}

module.exports = messagesRoutes;
