const templateRequestSchema = require('../schemas/templateRequest.schema');

// Accept any Graph API version prefix (e.g. v19.0, v26.0), like the real API
const VERSION = ':version(^v\\d+\\.\\d+$)';

const security = [{ bearerAuth: [] }];

const versionParam = { type: 'string', examples: ['v26.0'] };

function params(name, example, description) {
  return {
    type: 'object',
    properties: {
      version: versionParam,
      [name]: { type: 'string', examples: [example], description }
    },
    required: ['version', name]
  };
}

/**
 * Graph API routes besides messaging: phone number node, message templates
 * and the Resumable Upload API
 */
async function graphRoutes(fastify, options) {
  const { handlers, auth } = options;
  const { uploads } = options.config;

  // Upload bytes arrive raw, with application/octet-stream or no content-type
  fastify.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: uploads.maxBytes }, (request, body, done) => {
    done(null, body);
  });

  // An empty Content-Type header would otherwise be rejected with 415
  async function dropEmptyContentType(request) {
    if (request.headers['content-type'] === '') {
      delete request.headers['content-type'];
    }
  }

  /**
   * GET /:version/:nodeId
   * Phone number node (any numeric ID) or upload session progress (upload:<id>)
   */
  fastify.get(`/${VERSION}/:nodeId`, {
    schema: {
      tags: ['Phone numbers', 'Uploads'],
      summary: 'Get a phone number or upload session',
      description: 'A numeric ID returns the business phone number; an `upload:<id>` returns `{ id, file_offset }`.',
      security,
      params: params('nodeId', '987654321098765', 'Phone number ID or upload:<id>'),
      querystring: {
        type: 'object',
        properties: {
          fields: { type: 'string', description: 'Comma separated fields', examples: ['display_phone_number,verified_name,quality_rating'] }
        }
      }
    },
    onRequest: auth
  }, handlers.getNode);

  /**
   * POST /:version/upload:<id>
   * Upload file bytes (body is the raw file)
   */
  fastify.post(`/${VERSION}/:nodeId`, {
    bodyLimit: uploads.maxBytes,
    schema: {
      tags: ['Uploads'],
      summary: 'Upload file bytes to an upload session',
      description: 'Send the raw file as the body with a `file_offset` header (0 for a new upload). Returns `{ h }` once all `file_length` bytes arrived.',
      security,
      params: params('nodeId', 'upload:abc123', 'Upload session ID returned by POST /:version/:appId/uploads'),
      headers: {
        type: 'object',
        properties: {
          file_offset: { type: 'string', description: 'Bytes already uploaded', examples: ['0'] }
        }
      }
    },
    onRequest: [dropEmptyContentType, auth]
  }, handlers.postNode);

  /**
   * GET /:version/:wabaId/message_templates
   */
  fastify.get(`/${VERSION}/:wabaId/message_templates`, {
    schema: {
      tags: ['Templates'],
      summary: 'List message templates',
      security,
      params: params('wabaId', '123456789012345'),
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, default: 25 },
          after: { type: 'string', description: 'Cursor from paging.cursors.after' },
          fields: { type: 'string', examples: ['id,name,language,category,status,parameter_format,components,rejected_reason'] },
          name: { type: 'string', description: 'Names containing this text' },
          status: { type: 'string' },
          category: { type: 'string' },
          language: { type: 'string' }
        }
      }
    },
    onRequest: auth
  }, handlers.listTemplates);

  /**
   * POST /:version/:wabaId/message_templates
   */
  fastify.post(`/${VERSION}/:wabaId/message_templates`, {
    schema: {
      tags: ['Templates'],
      summary: 'Create a message template',
      description: 'Created templates are PENDING and get reviewed after TEMPLATE_REVIEW_DELAY_MS: APPROVED, or REJECTED when the name starts with TEMPLATE_REJECT_PREFIX.',
      security,
      params: params('wabaId', '123456789012345'),
      body: templateRequestSchema
    },
    onRequest: auth
  }, handlers.createTemplate);

  /**
   * POST /:version/:appId/uploads
   * Start a Resumable Upload session
   */
  fastify.post(`/${VERSION}/:appId/uploads`, {
    schema: {
      tags: ['Uploads'],
      summary: 'Start an upload session',
      security,
      params: params('appId', '1234567890'),
      querystring: {
        type: 'object',
        properties: {
          file_name: { type: 'string', examples: ['header.jpg'] },
          file_length: { type: 'string', description: 'File size in bytes', examples: ['102400'] },
          file_type: { type: 'string', examples: ['image/jpeg'] }
        }
      }
    },
    onRequest: auth
  }, handlers.createUploadSession);
}

module.exports = graphRoutes;
