/**
 * Approved templates every WABA starts with, so campaigns can be sent right away
 */
const SEED_HEADER_HANDLE = '4::aW1hZ2UvanBlZw==:fake-seed-header-handle';

const templateSeeds = [
  {
    name: 'hello_world',
    language: 'en_US',
    category: 'UTILITY',
    parameter_format: 'POSITIONAL',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Hello World' },
      {
        type: 'BODY',
        text: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.'
      },
      { type: 'FOOTER', text: 'WhatsApp Business Platform sample message' }
    ]
  },
  {
    name: 'order_update',
    language: 'en_US',
    category: 'UTILITY',
    parameter_format: 'POSITIONAL',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, your order is on its way.',
        example: { body_text: [['Ana']] }
      }
    ]
  },
  {
    name: 'promo_image',
    language: 'en_US',
    category: 'MARKETING',
    parameter_format: 'POSITIONAL',
    components: [
      { type: 'HEADER', format: 'IMAGE', example: { header_handle: [SEED_HEADER_HANDLE] } },
      {
        type: 'BODY',
        text: "Hi {{1}}, check out this week's deals!",
        example: { body_text: [['Ana']] }
      },
      { type: 'FOOTER', text: 'Reply STOP to opt out' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'URL', text: 'Shop now', url: 'https://example.com/shop' },
          { type: 'QUICK_REPLY', text: 'Stop promotions' }
        ]
      }
    ]
  },
  {
    name: 'welcome_named',
    language: 'en_US',
    category: 'MARKETING',
    parameter_format: 'NAMED',
    components: [
      {
        type: 'BODY',
        text: 'Welcome {{first_name}}! Your discount code is {{code}}.',
        example: {
          body_text_named_params: [
            { param_name: 'first_name', example: 'Ana' },
            { param_name: 'code', example: 'WELCOME10' }
          ]
        }
      }
    ]
  }
];

module.exports = { templateSeeds };
