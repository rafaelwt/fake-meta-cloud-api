/**
 * Delay utilities for simulating realistic message delivery timing
 */

/**
 * Generate a random delay between min and max milliseconds
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {number} - Random delay value
 */
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a specified amount of time
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get delay configuration from environment or use defaults
 * @param {object} config - Configuration object with delay settings
 * @returns {object} - Delay configuration
 */
function getDelayConfig(config) {
  return {
    sent: {
      min: parseInt(config.DELAY_SENT_MIN || '500', 10),
      max: parseInt(config.DELAY_SENT_MAX || '2000', 10)
    },
    delivered: {
      min: parseInt(config.DELAY_DELIVERED_MIN || '3000', 10),
      max: parseInt(config.DELAY_DELIVERED_MAX || '5000', 10)
    },
    read: {
      min: parseInt(config.DELAY_READ_MIN || '5000', 10),
      max: parseInt(config.DELAY_READ_MAX || '10000', 10)
    }
  };
}

module.exports = {
  randomDelay,
  sleep,
  getDelayConfig
};
