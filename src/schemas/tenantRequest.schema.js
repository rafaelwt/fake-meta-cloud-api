/**
 * POST /fake/tenants request body
 */
module.exports = {
  type: 'object',
  required: ['phone_number_id', 'waba_id', 'access_token'],
  properties: {
    phone_number_id: { type: 'string', pattern: '^\\d+$' },
    waba_id: { type: 'string', pattern: '^\\d+$' },
    display_phone_number: { type: 'string', minLength: 1 },
    verified_name: { type: 'string', minLength: 1 },
    quality_rating: { type: 'string', enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'] },
    access_token: { type: 'string', minLength: 1 },
    webhook_url: { type: 'string', format: 'uri', pattern: '^https?://' },
    app_secret: { type: 'string', minLength: 1 }
  }
};
