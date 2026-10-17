const messageRequestSchema = require('../schemas/messageRequest.schema');
const markReadRequestSchema = require('../schemas/markReadRequest.schema');
const messageExamples = require('../docs/messageExamples');

/**
 * API reference (OpenAPI + Scalar) for development
 * Packages are devDependencies: they are only required when docs are enabled
 */

/**
 * Decide if docs are served
 * DOCS_ENABLED wins; otherwise docs are on only in development
 * @param {object} env - Environment variables
 * @param {string} nodeEnv - Server environment
 * @returns {boolean}
 */
function docsEnabled(env, nodeEnv) {
  if (env.DOCS_ENABLED !== undefined) {
    return env.DOCS_ENABLED === 'true';
  }
  return nodeEnv === 'development';
}

/**
 * Flatten the validation schema (if/then branches) into one documented schema per type
 * @returns {object} - Body schema for docs only
 */
function buildMessagesDocsBody() {
  const { allOf, ...common } = messageRequestSchema;

  const variants = allOf.map(branch => {
    const type = branch.if.properties.type.const;
    return {
      title: type,
      type: 'object',
      required: [...common.required, ...branch.then.required],
      properties: {
        ...common.properties,
        type: { type: 'string', enum: [type] },
        ...branch.then.properties
      }
    };
  });

  return {
    oneOf: [...variants, { title: 'mark as read', ...markReadRequestSchema }],
    'x-examples': messageExamples
  };
}

/**
 * Register OpenAPI generation and the Scalar reference at /docs
 * Must be called before routes are registered
 * @param {object} app - Fastify instance
 * @param {object} config - App configuration
 */
function registerDocs(app, config) {
  if (!docsEnabled(process.env, config.server.env)) {
    return;
  }

  app.register(require('@fastify/swagger'), {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Fake Meta Cloud API',
        version: '1.0.0',
        description: 'Mock WhatsApp Business Cloud API (Graph API v26.0). Status updates and inbound messages are delivered to `WEBHOOK_URL`, signed with `X-Hub-Signature-256`.'
      },
      servers: [{ url: `http://localhost:${config.server.port}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', description: 'Value of API_ACCESS_TOKEN' }
        }
      },
      tags: [
        { name: 'Messages', description: 'Meta Cloud API compatible endpoints' },
        { name: 'Simulation', description: 'Fake-only endpoints to drive tests' },
        { name: 'Debug', description: 'Inspect stored messages and webhooks' },
        { name: 'Health' }
      ]
    },
    transform: ({ schema, url, route }) => {
      if (route.method === 'POST' && url.endsWith('/messages')) {
        return { schema: { ...schema, body: buildMessagesDocsBody() }, url };
      }
      return { schema, url };
    }
  });

  app.register(require('@scalar/fastify-api-reference'), { routePrefix: '/docs' });
}

module.exports = {
  docsEnabled,
  registerDocs
};
