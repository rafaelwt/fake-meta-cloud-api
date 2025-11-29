/**
 * Error pattern matching for automatic error simulation
 * Maps phone number patterns to specific Meta error codes
 */

/**
 * Parse error patterns from configuration string
 * Format: "+99999:131026,+88888:131047"
 * @param {string} patternsString - Comma-separated patterns
 * @returns {Map} - Map of pattern to error code
 */
function parseErrorPatterns(patternsString) {
  const patterns = new Map();

  if (!patternsString) {
    return patterns;
  }

  const pairs = patternsString.split(',').map(p => p.trim());

  for (const pair of pairs) {
    const [pattern, code] = pair.split(':').map(p => p.trim());
    if (pattern && code) {
      patterns.set(pattern, parseInt(code, 10));
    }
  }

  return patterns;
}

/**
 * Check if a phone number matches any error pattern
 * @param {string} phoneNumber - Phone number to check (with or without +)
 * @param {Map} patterns - Map of patterns to error codes
 * @returns {number|null} - Error code if match found, null otherwise
 */
function matchErrorPattern(phoneNumber, patterns) {
  const normalizedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

  for (const [pattern, errorCode] of patterns.entries()) {
    if (normalizedNumber.includes(pattern) || phoneNumber.includes(pattern.replace('+', ''))) {
      return errorCode;
    }
  }

  return null;
}

/**
 * Check if a phone number should trigger an error
 * @param {string} phoneNumber - Phone number to check
 * @param {string} patternsConfig - Configuration string with patterns
 * @returns {number|null} - Error code or null
 */
function shouldTriggerError(phoneNumber, patternsConfig) {
  const patterns = parseErrorPatterns(patternsConfig);
  return matchErrorPattern(phoneNumber, patterns);
}

module.exports = {
  parseErrorPatterns,
  matchErrorPattern,
  shouldTriggerError
};
