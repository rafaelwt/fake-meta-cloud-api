const os = require('os');
const path = require('path');

/**
 * Resolve where log files are written
 * LOG_DIR wins; under `node --test` (NODE_TEST_CONTEXT) logs go to a temp
 * directory so test runs never mix with the server logs
 * @param {object} env - Environment variables
 * @returns {string} - Absolute log directory
 */
function resolveLogDir(env) {
  if (env.LOG_DIR) {
    return env.LOG_DIR;
  }
  if (env.NODE_TEST_CONTEXT) {
    return path.join(os.tmpdir(), 'fake-meta-cloud-api-test-logs');
  }
  return path.join(__dirname, '..', '..', 'logs');
}

module.exports = { resolveLogDir };
