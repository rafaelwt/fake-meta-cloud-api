/**
 * POST /:version/:wabaId/message_templates request body
 */
const categories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const parameterFormats = ['POSITIONAL', 'NAMED'];

const withLowercase = values => [...values, ...values.map(v => v.toLowerCase())];

module.exports = {
  type: 'object',
  required: ['name', 'language', 'category', 'components'],
  properties: {
    name: { type: 'string', pattern: '^[a-z0-9_]{1,512}$' },
    language: { type: 'string', minLength: 2 },
    category: { type: 'string', enum: withLowercase(categories) },
    parameter_format: { type: 'string', enum: withLowercase(parameterFormats) },
    components: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: withLowercase(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']) }
        }
      }
    },
    message_send_ttl_seconds: { type: 'integer', minimum: 0 }
  }
};
