/**
 * Meta WhatsApp Cloud API Error Codes
 * Based on official Meta documentation
 */

const ERROR_CODES = {
  131047: {
    code: 131047,
    title: 'Re-engagement message',
    message: 'Re-engagement message was not delivered because the destination phone number has not communicated with your WhatsApp Business account in the last 24 hours',
    error_data: {
      details: 'Message failed to send because more than 24 hours have passed since the customer last replied to this number'
    }
  },

  131045: {
    code: 131045,
    title: 'Spam rate limit hit',
    message: 'Message could not be sent because there were too many messages sent from this phone number in a short period of time',
    error_data: {
      details: 'Spam rate limit has been exceeded for this phone number'
    }
  },

  131026: {
    code: 131026,
    title: 'Message undeliverable',
    message: 'Message is undeliverable due to phone number being invalid or blocked',
    error_data: {
      details: 'The phone number is not a valid WhatsApp number or has blocked your business account'
    }
  },

  131031: {
    code: 131031,
    title: 'Recipient phone number not available',
    message: 'The recipient phone number is not available on WhatsApp',
    error_data: {
      details: 'The phone number does not have an active WhatsApp account'
    }
  },

  131051: {
    code: 131051,
    title: 'Unsupported message type',
    message: 'The message type sent is not supported',
    error_data: {
      details: 'The message contains unsupported content or format'
    }
  },

  133016: {
    code: 133016,
    title: "User's number is part of an experiment",
    message: 'Message could not be delivered because the user is part of an experiment',
    error_data: {
      details: 'The recipient phone number is part of a WhatsApp experiment and cannot receive messages temporarily'
    }
  }
};

/**
 * Get error details by code
 * @param {number} code - Error code
 * @returns {object|null} - Error details or null if not found
 */
function getErrorByCode(code) {
  return ERROR_CODES[code] || null;
}

/**
 * Get all available error codes
 * @returns {Array<number>} - Array of error codes
 */
function getAllErrorCodes() {
  return Object.keys(ERROR_CODES).map(code => parseInt(code, 10));
}

/**
 * Check if error code is valid
 * @param {number} code - Error code to check
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidErrorCode(code) {
  return ERROR_CODES.hasOwnProperty(code);
}

module.exports = {
  ERROR_CODES,
  getErrorByCode,
  getAllErrorCodes,
  isValidErrorCode
};
