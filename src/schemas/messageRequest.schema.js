/**
 * JSON Schema for WhatsApp message requests
 * Supports: template, text, image, document, audio, video
 * Strict validation matching Meta Cloud API spec
 */

const messageRequestSchema = {
  type: 'object',
  required: ['messaging_product', 'to', 'type'],
  properties: {
    messaging_product: {
      type: 'string',
      enum: ['whatsapp']
    },
    recipient_type: {
      type: 'string',
      enum: ['individual']
    },
    to: {
      type: 'string',
      pattern: '^\\+?[1-9]\\d{1,14}$' // E.164 format
    },
    type: {
      type: 'string',
      enum: ['template', 'text', 'image', 'document', 'audio', 'video']
    }
  },
  allOf: [
    {
      // Template message
      if: {
        properties: { type: { const: 'template' } }
      },
      then: {
        required: ['template'],
        properties: {
          template: {
            type: 'object',
            required: ['name', 'language'],
            properties: {
              name: {
                type: 'string',
                minLength: 1
              },
              language: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: {
                    type: 'string',
                    pattern: '^[a-z]{2}(_[A-Z]{2})?$' // e.g., 'en', 'es', 'pt_BR'
                  }
                }
              },
              components: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['type'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['header', 'body', 'button']
                    },
                    parameters: {
                      type: 'array',
                      items: {
                        type: 'object'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      // Text message
      if: {
        properties: { type: { const: 'text' } }
      },
      then: {
        required: ['text'],
        properties: {
          text: {
            type: 'object',
            required: ['body'],
            properties: {
              body: {
                type: 'string',
                minLength: 1,
                maxLength: 4096
              },
              preview_url: {
                type: 'boolean'
              }
            }
          }
        }
      }
    },
    {
      // Image message
      if: {
        properties: { type: { const: 'image' } }
      },
      then: {
        required: ['image'],
        properties: {
          image: {
            type: 'object',
            properties: {
              link: {
                type: 'string',
                format: 'uri'
              },
              id: {
                type: 'string'
              },
              caption: {
                type: 'string',
                maxLength: 1024
              }
            },
            oneOf: [
              { required: ['link'] },
              { required: ['id'] }
            ]
          }
        }
      }
    },
    {
      // Document message
      if: {
        properties: { type: { const: 'document' } }
      },
      then: {
        required: ['document'],
        properties: {
          document: {
            type: 'object',
            properties: {
              link: {
                type: 'string',
                format: 'uri'
              },
              id: {
                type: 'string'
              },
              caption: {
                type: 'string',
                maxLength: 1024
              },
              filename: {
                type: 'string'
              }
            },
            oneOf: [
              { required: ['link'] },
              { required: ['id'] }
            ]
          }
        }
      }
    },
    {
      // Audio message
      if: {
        properties: { type: { const: 'audio' } }
      },
      then: {
        required: ['audio'],
        properties: {
          audio: {
            type: 'object',
            properties: {
              link: {
                type: 'string',
                format: 'uri'
              },
              id: {
                type: 'string'
              }
            },
            oneOf: [
              { required: ['link'] },
              { required: ['id'] }
            ]
          }
        }
      }
    },
    {
      // Video message
      if: {
        properties: { type: { const: 'video' } }
      },
      then: {
        required: ['video'],
        properties: {
          video: {
            type: 'object',
            properties: {
              link: {
                type: 'string',
                format: 'uri'
              },
              id: {
                type: 'string'
              },
              caption: {
                type: 'string',
                maxLength: 1024
              }
            },
            oneOf: [
              { required: ['link'] },
              { required: ['id'] }
            ]
          }
        }
      }
    }
  ]
};

module.exports = messageRequestSchema;
