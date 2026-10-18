const tenantRequestSchema = require('../schemas/tenantRequest.schema');
const { createAuthMiddleware } = require('../middleware/auth.middleware');
const { metaError } = require('../utils/metaError');

const security = [{ adminAuth: [] }];

/**
 * Fake-only admin routes: register phone numbers (tenants) with their own
 * token, webhook URL and app secret. Disabled unless ADMIN_TOKEN is set.
 */
async function adminRoutes(fastify, options) {
  const { handlers, config } = options;

  async function adminEnabled(request, reply) {
    if (!config.admin.token) {
      return reply.status(403).send(metaError(10, 'Admin API is disabled: set ADMIN_TOKEN to enable it'));
    }
  }

  const adminAuth = createAuthMiddleware(config, () => [config.admin.token]);
  const onRequest = [adminEnabled, adminAuth];

  fastify.post('/fake/tenants', {
    schema: {
      tags: ['Admin'],
      summary: 'Register or update a phone number',
      description: 'Answers 201 when created, 200 when updated. access_token and app_secret are never returned. webhook_url and app_secret default to WEBHOOK_URL and APP_SECRET.',
      security,
      body: tenantRequestSchema
    },
    onRequest
  }, handlers.registerTenant);

  fastify.get('/fake/tenants', {
    schema: { tags: ['Admin'], summary: 'List registered phone numbers', security },
    onRequest
  }, handlers.listTenants);

  fastify.delete('/fake/tenants/:phoneNumberId', {
    schema: {
      tags: ['Admin'],
      summary: 'Remove a phone number',
      security,
      params: {
        type: 'object',
        properties: { phoneNumberId: { type: 'string', examples: ['987654321098765'] } },
        required: ['phoneNumberId']
      }
    },
    onRequest
  }, handlers.removeTenant);
}

module.exports = adminRoutes;
