/**
 * Response schemas for the API reference only
 * Not used for serialization: Fastify response schemas would strip
 * undeclared fields (e.g. free-form webhook payloads) from real responses
 */

const metaErrorResponse = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['message', 'type', 'code', 'fbtrace_id'],
      properties: {
        message: { type: 'string' },
        type: { type: 'string', examples: ['OAuthException'] },
        code: { type: 'integer', description: '100 invalid parameter, 190 invalid token, 2500 missing token or unknown path, 1 unknown' },
        error_subcode: { type: 'integer', description: '467 for an invalid token' },
        error_data: {
          type: 'object',
          properties: {
            messaging_product: { type: 'string' },
            details: { type: 'string' }
          }
        },
        fbtrace_id: { type: 'string' }
      }
    }
  }
};

const sendMessageResponse = {
  title: 'message accepted',
  type: 'object',
  required: ['messaging_product', 'contacts', 'messages'],
  properties: {
    messaging_product: { type: 'string', enum: ['whatsapp'] },
    contacts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['input', 'wa_id'],
        properties: {
          input: { type: 'string' },
          wa_id: { type: 'string' }
        }
      }
    },
    messages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'message_status'],
        properties: {
          id: { type: 'string', examples: ['wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI'] },
          message_status: { type: 'string', enum: ['accepted'] }
        }
      }
    }
  }
};

const markAsReadResponse = {
  title: 'marked as read',
  type: 'object',
  required: ['success'],
  properties: {
    success: { type: 'boolean', enum: [true] }
  }
};

const webhookEvent = {
  type: 'object',
  required: ['id', 'message_id', 'event_type', 'webhook_url', 'payload', 'sent_at', 'success'],
  properties: {
    id: { type: 'integer' },
    message_id: { type: 'string' },
    event_type: { type: 'string', enum: ['sent', 'delivered', 'read', 'failed'] },
    webhook_url: { type: 'string' },
    payload: { type: 'object', description: 'Webhook body as sent' },
    response_status: { type: ['integer', 'null'] },
    response_body: { type: ['string', 'null'] },
    sent_at: { type: 'integer', description: 'Unix timestamp' },
    success: { type: 'integer', enum: [0, 1] },
    error: { type: ['string', 'null'] }
  }
};

const countMap = { type: 'object', additionalProperties: { type: 'integer' } };

const unauthorized = { description: 'Missing (2500) or invalid (190/467) token', ...metaErrorResponse };

/**
 * Responses per route, keyed by "METHOD path suffix"
 */
const responseSchemas = {
  'POST /messages': {
    200: { description: 'Message accepted, or inbound message marked as read', oneOf: [sendMessageResponse, markAsReadResponse] },
    400: { description: 'Invalid parameter (100)', ...metaErrorResponse },
    401: unauthorized
  },
  'POST /simulate/inbound': {
    200: {
      description: 'Inbound message stored and webhook sent',
      type: 'object',
      required: ['messaging_product', 'messages'],
      properties: {
        messaging_product: { type: 'string', enum: ['whatsapp'] },
        messages: {
          type: 'array',
          items: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
        }
      }
    },
    400: { description: 'Invalid parameter (100)', ...metaErrorResponse },
    401: unauthorized
  },
  'GET /messages/stats': {
    200: {
      description: 'Stats over the last 100 messages',
      type: 'object',
      required: ['total_messages', 'by_status', 'by_type'],
      properties: {
        total_messages: { type: 'integer' },
        by_status: countMap,
        by_type: countMap
      }
    },
    401: unauthorized
  },
  'GET /webhooks/events': {
    200: {
      description: 'Recent events, or events for one message when messageId is given',
      type: 'object',
      required: ['events'],
      properties: {
        message_id: { type: 'string' },
        events: { type: 'array', items: webhookEvent }
      }
    },
    401: unauthorized
  },
  'GET /health': {
    200: {
      description: 'Process is alive',
      type: 'object',
      required: ['status', 'uptime', 'timestamp', 'memory', 'database'],
      properties: {
        status: { type: 'string', enum: ['healthy'] },
        uptime: { type: 'integer', description: 'Seconds' },
        timestamp: { type: 'string', format: 'date-time' },
        memory: {
          type: 'object',
          properties: {
            heapUsed: { type: 'string', examples: ['18MB'] },
            heapTotal: { type: 'string' },
            rss: { type: 'string' }
          }
        },
        database: { type: 'string', enum: ['connected', 'disconnected'] }
      }
    }
  },
  'GET /ready': {
    200: {
      description: 'Database is open',
      type: 'object',
      required: ['status'],
      properties: { status: { type: 'string', enum: ['ready'] } }
    },
    503: {
      description: 'Database is not open',
      type: 'object',
      required: ['status', 'reason'],
      properties: {
        status: { type: 'string', enum: ['not ready'] },
        reason: { type: 'string' }
      }
    }
  }
};

/**
 * Find documented responses for a route
 * @param {string} method - HTTP method
 * @param {string} url - Route URL
 * @returns {object|undefined} - Responses by status code
 */
function findResponseSchemas(method, url) {
  const key = Object.keys(responseSchemas).find(k => {
    const [m, suffix] = k.split(' ');
    return m === method && url.endsWith(suffix);
  });
  return key && responseSchemas[key];
}

module.exports = { findResponseSchemas };
