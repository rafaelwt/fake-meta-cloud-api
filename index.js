const { createServer } = require('./src/server');
const config = require('./src/config');

/**
 * Start the Fake Meta Cloud API server
 */
async function start() {
  const app = createServer();

  try {
    const address = await app.listen({
      port: config.server.port,
      host: config.server.host
    });

    app.log.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║          Fake Meta Cloud API Server Started                ║
║                                                            ║
║  Server:    ${address.padEnd(43)}║
║  Env:       ${config.server.env.padEnd(43)}║
║  Webhook:   ${config.webhook.url.padEnd(43)}║
║                                                            ║
║  Endpoints:                                                ║
║  - Health:   GET  /health                                  ║
║  - Ready:    GET  /ready                                   ║
║  - Messages: POST /v19.0/:wabaId/messages                  ║
║  - Stats:    GET  /v19.0/:wabaId/messages/stats            ║
║  - Events:   GET  /v19.0/:wabaId/webhooks/events           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);

    app.log.info({
      delays: config.delays,
      readProbability: config.behavior.readProbability,
      errorPatterns: config.errors.patterns
    }, 'Configuration loaded');

  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
start();
