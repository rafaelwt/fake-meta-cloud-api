/**
 * Health check routes
 * Provides status and diagnostic information
 */

async function healthRoutes(fastify, options) {
  /**
   * Health check endpoint
   */
  fastify.get('/health', async (request, reply) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    return {
      status: 'healthy',
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      },
      database: fastify.db?.open ? 'connected' : 'disconnected'
    };
  });

  /**
   * Ready check endpoint
   */
  fastify.get('/ready', async (request, reply) => {
    if (!fastify.db || !fastify.db.open) {
      return reply.status(503).send({
        status: 'not ready',
        reason: 'database not connected'
      });
    }

    return {
      status: 'ready'
    };
  });
}

module.exports = healthRoutes;
