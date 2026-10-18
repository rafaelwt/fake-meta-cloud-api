const { matchPattern } = require('./errorPatterns');
const { getErrorByCode } = require('../config/errorCodes');
const { metaError } = require('./metaError');

/**
 * Synchronous error simulation for POST messages
 * The HTTP response itself fails (nothing is stored, no webhook is sent)
 */

// HTTP status, Graph code and message for each configurable error
const SYNC_ERRORS = {
  130429: {
    httpStatus: 429,
    message: '(#130429) Rate limit hit',
    details: 'Cloud API message throughput has been reached.'
  },
  131056: {
    httpStatus: 400,
    message: '(#131056) (Business Account, Consumer Account) pair rate limit hit',
    details: 'Message failed to send because there were too many messages sent from this phone number to the same phone number in a short period of time.'
  },
  131000: {
    httpStatus: 500,
    message: '(#131000) Something went wrong',
    details: 'Something went wrong.',
    transient: true
  },
  500: { httpStatus: 500, graphCode: 1, message: 'An unknown error has occurred.', transient: true },
  503: { httpStatus: 503, graphCode: 2, message: 'Service temporarily unavailable', transient: true }
};

// Failures already returned per pattern + recipient for "xN" patterns
const failureCounts = new Map();

/**
 * Parse sync error patterns
 * Format: "+11111:130429,+55555:503x2" (xN = fail N times, then accept once)
 * @param {string} patternsString - Comma-separated patterns
 * @returns {Map} - Map of pattern to { code, times }
 */
function parseSyncErrorPatterns(patternsString) {
  const patterns = new Map();
  if (!patternsString) return patterns;

  for (const pair of patternsString.split(',').map(p => p.trim())) {
    const [pattern, spec] = pair.split(':').map(p => p.trim());
    const match = /^(\d+)(?:x(\d+))?$/.exec(spec || '');
    if (pattern && match) {
      patterns.set(pattern, {
        code: parseInt(match[1], 10),
        times: match[2] ? parseInt(match[2], 10) : null
      });
    }
  }

  return patterns;
}

/**
 * Parse response delay patterns
 * Format: "+44444:3000" (milliseconds)
 * @param {string} patternsString - Comma-separated patterns
 * @returns {Map} - Map of pattern to delay in ms
 */
function parseDelayPatterns(patternsString) {
  const patterns = new Map();
  if (!patternsString) return patterns;

  for (const pair of patternsString.split(',').map(p => p.trim())) {
    const [pattern, ms] = pair.split(':').map(p => p.trim());
    const delay = parseInt(ms, 10);
    if (pattern && Number.isInteger(delay) && delay >= 0) {
      patterns.set(pattern, delay);
    }
  }

  return patterns;
}

/**
 * Build the HTTP status and Meta error body for a sync error code
 * @param {number} code - Configured code (Graph code, or 500/503 for server errors)
 * @returns {{statusCode: number, body: object}}
 */
function buildSyncError(code) {
  const known = SYNC_ERRORS[code];
  const catalog = getErrorByCode(code);
  const message = known?.message || `(#${code}) ${catalog?.title || 'Error'}`;
  const details = known?.details || catalog?.error_data?.details;

  const extra = {};
  if (known?.transient) extra.is_transient = true;
  if (details) extra.error_data = { messaging_product: 'whatsapp', details };

  return {
    statusCode: known?.httpStatus || 400,
    body: metaError(known?.graphCode || code, message, extra)
  };
}

/**
 * Decide whether a send must fail synchronously
 * @param {string} phoneNumber - Recipient (message.to)
 * @param {string} patternsConfig - SYNC_ERROR_PATTERNS
 * @returns {{statusCode: number, body: object}|null} - Error response or null to accept
 */
function checkSyncError(phoneNumber, patternsConfig) {
  const match = matchPattern(phoneNumber, parseSyncErrorPatterns(patternsConfig));
  if (!match) return null;

  const { code, times } = match.value;
  if (times !== null) {
    const key = `${match.pattern}|${phoneNumber.replace('+', '')}`;
    const failures = failureCounts.get(key) || 0;
    if (failures >= times) {
      failureCounts.delete(key);
      return null;
    }
    failureCounts.set(key, failures + 1);
  }

  return buildSyncError(code);
}

/**
 * Get the configured response delay for a recipient
 * @param {string} phoneNumber - Recipient (message.to)
 * @param {string} patternsConfig - RESPONSE_DELAY_PATTERNS
 * @returns {number} - Delay in ms (0 when no pattern matches)
 */
function getResponseDelay(phoneNumber, patternsConfig) {
  const match = matchPattern(phoneNumber, parseDelayPatterns(patternsConfig));
  return match ? match.value : 0;
}

module.exports = {
  parseSyncErrorPatterns,
  parseDelayPatterns,
  checkSyncError,
  getResponseDelay
};
