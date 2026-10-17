const fastify = require('fastify');
const config = require('./config');
const logger = require('./logger');
const { db } = require('./database/models');
const { closeDatabase } = require('./database/connection');
const messagesController = require('./controllers/messagesController');
const { createAuthMiddleware } = require('./middleware/auth.middleware');

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
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    trustProxy: true
  });

  // Middleware
  const authMiddleware = createAuthMiddleware(config);

  // Plugins
  app.register(require('@fastify/cors'), {
    origin: true,
    credentials: true
  });

  // Routes
  app.register(require('./routes/health'));
  app.register(require('./routes/messages.routes'), {
    handlers: messagesController,
    auth: authMiddleware
  });

  // Root endpoint
  app.get('/', async (request, reply) => {
    return {
      name: 'Fake Meta Cloud API',
      version: '1.0.0',
      description: 'Mock WhatsApp Business Cloud API for testing',
      endpoints: {
        health: '/health',
        ready: '/ready',
        messages: 'POST /v19.0/:wabaId/messages',
        stats: 'GET /v19.0/:wabaId/messages/stats',
        webhook_events: 'GET /v19.0/:wabaId/webhooks/events'
      },
      documentation: 'See README.md for usage examples'
    };
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error({
      err: error,
      request: { method: request.method, url: request.url }
    }, 'Request error');

    if (error.validation) {
      return reply.status(400).send({
        error: {
          message: 'Validation failed',
          type: 'validation_error',
          code: 400,
          details: error.validation
        }
      });
    }

    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: {
        message: error.message || 'Internal Server Error',
        type: error.name || 'error',
        code: statusCode
      }
    });
  });

  // Graceful shutdown
  app.addHook('onClose', async (instance) => {
    logger.info('Closing server...');
    closeDatabase(db, logger);
  });

  return app;
}

module.exports = { createServer };
