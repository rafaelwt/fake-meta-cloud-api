const crypto = require('crypto');

/**
 * Generates realistic WhatsApp Message IDs (wamid format)
 * Format: wamid.{base64_encoded_data}
 *
 * Real example: wamid.HBgLNTkxNzkwMjE3ODQVAgARGBI1RjA4RDc3NjhEOUJBMzdFODEA
 */
class IdGenerator {
  /**
   * Generate a random wamid
   * @returns {string} - WhatsApp message ID in wamid format
   */
  static generateWamid() {
    // Generate 32 random bytes and encode as base64
    const randomData = crypto.randomBytes(32);
    const base64 = randomData.toString('base64')
      .replace(/\+/g, '')  // Remove + characters
      .replace(/\//g, '')  // Remove / characters
      .replace(/=/g, '');  // Remove padding

    return `wamid.${base64}`;
  }

  /**
   * Generate a unique ID for any purpose
   * @returns {string} - UUID v4
   */
  static generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Generate a numeric Graph object ID (e.g. template IDs)
   * @param {number} [length=16] - Number of digits
   * @returns {string} - Numeric ID without leading zero
   */
  static generateNumericId(length = 16) {
    let id = String(crypto.randomInt(1, 10));
    while (id.length < length) id += crypto.randomInt(0, 10);
    return id;
  }

  /**
   * Generate an opaque URL-safe token
   * @param {number} [bytes=24] - Random bytes
   * @returns {string} - base64url string
   */
  static generateToken(bytes = 24) {
    return crypto.randomBytes(bytes).toString('base64url');
  }
}

module.exports = IdGenerator;
