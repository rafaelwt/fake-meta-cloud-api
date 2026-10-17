/**
 * Request examples for POST /:version/:wabaId/messages
 * Shown in the API reference; tests check every send example against validation
 */

const to = '+59179021784';
const base = { messaging_product: 'whatsapp', to };

const messageExamples = {
  template: {
    summary: 'Template',
    value: {
      ...base,
      type: 'template',
      template: {
        name: 'order_update',
        language: { code: 'es' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'A-1024' }] }]
      }
    }
  },
  text: {
    summary: 'Text',
    value: { ...base, type: 'text', text: { body: 'Hello from the fake API', preview_url: false } }
  },
  reply: {
    summary: 'Text reply (context)',
    value: { ...base, type: 'text', text: { body: 'Sure!' }, context: { message_id: 'wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI' } }
  },
  image: {
    summary: 'Image',
    value: { ...base, type: 'image', image: { link: 'https://example.com/photo.jpg', caption: 'A photo' } }
  },
  document: {
    summary: 'Document',
    value: {
      ...base,
      type: 'document',
      document: { link: 'https://example.com/invoice.pdf', filename: 'invoice.pdf', caption: 'Your invoice' }
    }
  },
  audio: {
    summary: 'Audio',
    value: { ...base, type: 'audio', audio: { link: 'https://example.com/voice.ogg' } }
  },
  video: {
    summary: 'Video',
    value: { ...base, type: 'video', video: { link: 'https://example.com/clip.mp4', caption: 'A clip' } }
  },
  sticker: {
    summary: 'Sticker',
    value: { ...base, type: 'sticker', sticker: { id: '1234567890' } }
  },
  interactiveButtons: {
    summary: 'Interactive buttons',
    value: {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Confirm your order?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'confirm', title: 'Confirm' } },
            { type: 'reply', reply: { id: 'cancel', title: 'Cancel' } }
          ]
        }
      }
    }
  },
  interactiveList: {
    summary: 'Interactive list',
    value: {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: 'Choose a branch' },
        action: {
          button: 'Branches',
          sections: [{ title: 'La Paz', rows: [{ id: 'lpz-1', title: 'Centro' }] }]
        }
      }
    }
  },
  reaction: {
    summary: 'Reaction',
    value: { ...base, type: 'reaction', reaction: { message_id: 'wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI', emoji: '👍' } }
  },
  location: {
    summary: 'Location',
    value: { ...base, type: 'location', location: { latitude: -16.5, longitude: -68.15, name: 'La Paz', address: 'Bolivia' } }
  },
  contacts: {
    summary: 'Contacts',
    value: {
      ...base,
      type: 'contacts',
      contacts: [{ name: { formatted_name: 'Ana Pérez', first_name: 'Ana' }, phones: [{ phone: '+59170000000', type: 'CELL' }] }]
    }
  },
  markAsRead: {
    summary: 'Mark as read + typing indicator',
    value: {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI',
      typing_indicator: { type: 'text' }
    }
  }
};

module.exports = messageExamples;
