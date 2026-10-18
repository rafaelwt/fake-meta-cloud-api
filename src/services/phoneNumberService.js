const tenantService = require('./tenantService');
const { metaError } = require('../utils/metaError');
const { pickFields } = require('../utils/fields');

// Graph returns these when `fields` is not given
const DEFAULT_FIELDS = [
  'verified_name',
  'code_verification_status',
  'display_phone_number',
  'quality_rating',
  'platform_type',
  'throughput'
];

/**
 * Get a business phone number node
 * Registered numbers return their own profile; any other numeric ID the .env profile
 * @param {string} phoneNumberId - Phone number ID from the path
 * @param {string|undefined} fields - Graph `fields` parameter
 * @returns {object} - { response } or { error } in Meta format
 */
function getPhoneNumber(phoneNumberId, fields) {
  if (!/^\d+$/.test(phoneNumberId)) {
    return {
      error: metaError(100,
        `Unsupported get request. Object with ID '${phoneNumberId}' does not exist, cannot be loaded due to missing permissions, or does not support this operation. Please read the Graph API documentation at https://developers.facebook.com/docs/graph-api`,
        { error_subcode: 33 }
      )
    };
  }

  const tenant = tenantService.tenantForPhone(phoneNumberId);
  const phoneNumber = {
    id: phoneNumberId,
    verified_name: tenant.verified_name,
    code_verification_status: 'VERIFIED',
    display_phone_number: tenant.display_phone_number,
    quality_rating: tenant.quality_rating,
    platform_type: 'CLOUD_API',
    throughput: { level: 'STANDARD' }
  };

  return { response: pickFields(phoneNumber, fields, DEFAULT_FIELDS) };
}

module.exports = { getPhoneNumber };
