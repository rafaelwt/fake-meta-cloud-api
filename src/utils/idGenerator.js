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
}

module.exports = IdGenerator;
