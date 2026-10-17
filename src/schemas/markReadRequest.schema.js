/**
 * JSON Schema for marking an inbound message as read
 * Optionally shows a typing indicator to the user
 */

const markReadRequestSchema = {
  type: 'object',
  required: ['messaging_product', 'status', 'message_id'],
  properties: {
    messaging_product: {
      type: 'string',
      enum: ['whatsapp']
    },
    status: {
      type: 'string',
      enum: ['read']
    },
    message_id: {
      type: 'string',
      minLength: 1
    },
    typing_indicator: {
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['text']
        }
      }
    }
  }
};

module.exports = markReadRequestSchema;
