/**
 * POST /fake/tenants request body
 */
const delayRange = {
  type: 'object',
  required: ['min', 'max'],
  additionalProperties: false,
  properties: {
    min: { type: 'integer', minimum: 0 },
    max: { type: 'integer', minimum: 0 }
  }
};

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
    app_secret: { type: 'string', minLength: 1 },
    // Per-number status flow overrides (missing keys use the global DELAY_* / READ_PROBABILITY)
    status_delays: {
      type: 'object',
      // propertyNames rejects unknown keys (additionalProperties: false would silently drop them)
      propertyNames: { enum: ['sent', 'delivered', 'read'] },
      properties: { sent: delayRange, delivered: delayRange, read: delayRange }
    },
    read_probability: { type: 'number', minimum: 0, maximum: 1 }
  }
};
