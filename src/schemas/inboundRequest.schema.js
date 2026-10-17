/**
 * JSON Schema for simulated inbound user messages
 * Fake-only endpoint: not part of the Meta Cloud API
 */

const inboundRequestSchema = {
  type: 'object',
  required: ['from', 'text'],
  examples: [{ from: '+59179021784', name: 'Ana', text: { body: 'Hola!' } }],
  properties: {
    from: {
      type: 'string',
      pattern: '^\\+?[1-9]\\d{1,14}$' // E.164 format
    },
    name: {
      type: 'string',
      minLength: 1
    },
    text: {
      type: 'object',
      required: ['body'],
      properties: {
        body: {
          type: 'string',
          minLength: 1,
          maxLength: 4096
        }
      }
    }
  }
};

module.exports = inboundRequestSchema;
