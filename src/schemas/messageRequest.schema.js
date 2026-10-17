/**
 * JSON Schema for WhatsApp message requests
 * Supports: template, text, image, document, audio, video, sticker,
 * interactive, reaction, location, contacts
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
      enum: [
        'template', 'text', 'image', 'document', 'audio', 'video', 'sticker',
        'interactive', 'reaction', 'location', 'contacts'
      ]
    },
    context: {
      // Reply to a previous message
      type: 'object',
      required: ['message_id'],
      properties: {
        message_id: { type: 'string', minLength: 1 }
      }
    }
  },
  allOf: [
    {
      // Template message
      if: {
        required: ['type'],
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
        required: ['type'],
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
        required: ['type'],
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
        required: ['type'],
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
        required: ['type'],
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
        required: ['type'],
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
    },
    {
      // Sticker message
      if: {
        required: ['type'],
        properties: { type: { const: 'sticker' } }
      },
      then: {
        required: ['sticker'],
        properties: {
          sticker: {
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
      // Interactive message (buttons, lists, CTA URL, flows, ...)
      if: {
        required: ['type'],
        properties: { type: { const: 'interactive' } }
      },
      then: {
        required: ['interactive'],
        properties: {
          interactive: {
            type: 'object',
            required: ['type', 'action'],
            properties: {
              type: {
                type: 'string',
                enum: [
                  'button', 'list', 'cta_url', 'flow', 'product', 'product_list',
                  'catalog_message', 'location_request_message', 'call_permission_request'
                ]
              },
              header: { type: 'object' },
              body: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', minLength: 1, maxLength: 1024 }
                }
              },
              footer: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', minLength: 1, maxLength: 60 }
                }
              },
              action: { type: 'object' }
            }
          }
        }
      }
    },
    {
      // Reaction message (empty emoji removes the reaction)
      if: {
        required: ['type'],
        properties: { type: { const: 'reaction' } }
      },
      then: {
        required: ['reaction'],
        properties: {
          reaction: {
            type: 'object',
            required: ['message_id', 'emoji'],
            properties: {
              message_id: { type: 'string', minLength: 1 },
              emoji: { type: 'string' }
            }
          }
        }
      }
    },
    {
      // Location message
      if: {
        required: ['type'],
        properties: { type: { const: 'location' } }
      },
      then: {
        required: ['location'],
        properties: {
          location: {
            type: 'object',
            required: ['latitude', 'longitude'],
            properties: {
              latitude: { type: 'number', minimum: -90, maximum: 90 },
              longitude: { type: 'number', minimum: -180, maximum: 180 },
              name: { type: 'string' },
              address: { type: 'string' }
            }
          }
        }
      }
    },
    {
      // Contacts message
      if: {
        required: ['type'],
        properties: { type: { const: 'contacts' } }
      },
      then: {
        required: ['contacts'],
        properties: {
          contacts: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                name: {
                  type: 'object',
                  required: ['formatted_name'],
                  properties: {
                    formatted_name: { type: 'string', minLength: 1 }
                  }
                },
                phones: { type: 'array', items: { type: 'object' } },
                emails: { type: 'array', items: { type: 'object' } },
                addresses: { type: 'array', items: { type: 'object' } },
                org: { type: 'object' },
                urls: { type: 'array', items: { type: 'object' } }
              }
            }
          }
        }
      }
    }
  ]
};

module.exports = messageRequestSchema;
