const crypto = require('crypto');

/**
 * Sign a webhook body the way Meta does
 * Header value for X-Hub-Signature-256: "sha256=" + HMAC-SHA256(appSecret, rawBody)
 * @param {string} rawBody - Exact body string sent over the wire
 * @param {string} appSecret - App secret used as HMAC key
 * @returns {string} - Signature header value
 */
function signPayload(rawBody, appSecret) {
  const digest = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return `sha256=${digest}`;
}

module.exports = { signPayload };
