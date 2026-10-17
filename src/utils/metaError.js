const crypto = require('crypto');

/**
 * Build an error response body in Meta Graph API format
 * { error: { message, type, code, error_subcode?, error_data?, fbtrace_id } }
 * @param {number} code - Meta error code (e.g. 100 invalid parameter, 190 invalid token)
 * @param {string} message - Error message
 * @param {object} [extra] - Optional error_subcode, error_data and type
 * @returns {object} - Error response body
 */
function metaError(code, message, extra = {}) {
  const { type = 'OAuthException', ...rest } = extra;

  return {
    error: {
      message,
      type,
      code,
      ...rest,
      fbtrace_id: crypto.randomBytes(18).toString('base64url')
    }
  };
}

module.exports = { metaError };
