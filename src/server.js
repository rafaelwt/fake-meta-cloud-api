const fastify = require('fastify');
const config = require('./config');
const logger = require('./logger');
const { db } = require('./database/models');
const { closeDatabase } = require('./database/connection');
const messagesController = require('./controllers/messagesController');
const graphController = require('./controllers/graphController');
const adminController = require('./controllers/adminController');
const { createAuthMiddleware } = require('./middleware/auth.middleware');
const tenantService = require('./services/tenantService');
const { metaError } = require('./utils/metaError');
const { registerDocs } = require('./plugins/docs');
const { cancelAllFlows } = require('./events/emitter');

// Register event listeners (auto-registers on require)
require('./events/listeners/sentListener');
require('./events/listeners/deliveredListener');
require('./events/listeners/readListener');
require('./events/listeners/failedListener');

/**
 * Create and configure Fastify server
 */
function createServer() {
  const app = fastify({
    loggerInstance: logger,
    trustProxy: true
  });

  // Database handle for health checks
  app.decorate('db', db);

  // Middleware
  // Each route declares whose token it needs (config.authScope / config.authParam)
  const authMiddleware = createAuthMiddleware(config, (request) => {
    const { authScope, authParam } = request.routeOptions.config;
    if (!authScope) return [config.auth.accessToken];
    return tenantService.acceptedTokens(authScope, request.params[authParam]);
  });

  // Plugins
  app.register(require('@fastify/cors'), {
    origin: true,
    credentials: true
  });

  // API reference at /docs (development only, before routes)
  registerDocs(app, config);

  // Routes
  app.register(require('./routes/health'));
  app.register(require('./routes/messages.routes'), {
    handlers: messagesController,
    auth: authMiddleware
  });
  app.register(require('./routes/graph.routes'), {
    handlers: graphController,
    auth: authMiddleware,
    config
  });
  app.register(require('./routes/admin.routes'), {
    handlers: adminController,
    config
  });

  // Root endpoint
  app.get('/', { schema: { hide: true } }, async (request, reply) => {
    return {
      name: 'Fake Meta Cloud API',
      version: '1.0.0',
      description: 'Mock WhatsApp Business Cloud API for testing',
      endpoints: {
        health: '/health',
        ready: '/ready',
        messages: 'POST /v26.0/:wabaId/messages',
        stats: 'GET /v26.0/:wabaId/messages/stats',
        webhook_events: 'GET /v26.0/:wabaId/webhooks/events',
        simulate_inbound: 'POST /v26.0/:wabaId/simulate/inbound',
        simulate_status: 'POST /v26.0/:phoneNumberId/simulate/status',
        phone_number: 'GET /v26.0/:phoneNumberId',
        templates: 'GET|POST /v26.0/:wabaId/message_templates',
        upload_session: 'POST /v26.0/:appId/uploads',
        upload_bytes: 'POST /v26.0/upload:<id>',
        tenants: 'GET|POST /fake/tenants, DELETE /fake/tenants/:phoneNumberId (ADMIN_TOKEN)',
        reset: 'POST /fake/reset (ADMIN_TOKEN)',
        docs: 'GET /docs (development)'
      },
      documentation: 'See README.md for usage examples'
    };
  });

  // Unknown routes answer like Graph API (HTTP 400, code 2500)
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0];
    reply.status(400).send(metaError(2500, `Unknown path components: ${path}`));
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error({
      err: error,
      request: { method: request.method, url: request.url }
    }, 'Request error');

    if (error.validation) {
      return reply.status(400).send(metaError(100, '(#100) Invalid parameter', {
        error_data: {
          messaging_product: 'whatsapp',
          details: error.message
        }
      }));
    }

    const statusCode = error.statusCode || 500;
    if (statusCode < 500) {
      return reply.status(statusCode).send(metaError(100, error.message));
    }

    reply.status(statusCode).send(metaError(1, 'An unknown error has occurred.'));
  });

  // Graceful shutdown
  app.addHook('onClose', async (instance) => {
    logger.info('Closing server...');
    cancelAllFlows();
    closeDatabase(db, logger);
  });

  return app;
}

module.exports = { createServer };
