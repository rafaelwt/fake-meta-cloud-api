const { metaError } = require('../utils/metaError');

// Graph API subcode for an expired, revoked or invalid access token
const INVALID_TOKEN_SUBCODE = 467;

/**
 * Authentication middleware for Bearer token validation
 * Validates Authorization header against configured access token
 */

/**
 * Create auth middleware
 * @param {object} config - Configuration object
 * @returns {Function} - Fastify middleware function
 */
function createAuthMiddleware(config) {
  const expectedToken = config.auth.accessToken;

  return async function authMiddleware(request, reply) {
    const authHeader = request.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
      return reply.status(401).send(metaError(
        2500,
        'An active access token must be used to query information about the current user.'
      ));
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return reply.status(401).send(metaError(
        190,
        'Invalid OAuth access token - Cannot parse access token',
        { error_subcode: INVALID_TOKEN_SUBCODE }
      ));
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token
    if (token !== expectedToken) {
      return reply.status(401).send(metaError(
        190,
        'Invalid OAuth access token - Cannot parse access token',
        { error_subcode: INVALID_TOKEN_SUBCODE }
      ));
    }

    // Token is valid, continue
    request.log.debug({ token: token.substring(0, 10) + '...' }, 'Token validated');
  };
}

module.exports = { createAuthMiddleware };
