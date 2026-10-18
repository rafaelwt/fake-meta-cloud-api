const { metaError } = require('../utils/metaError');

// Graph API subcode for an expired, revoked or invalid access token
const INVALID_TOKEN_SUBCODE = 467;

// Accepted Authorization header schemes
const AUTH_SCHEMES = ['Bearer ', 'OAuth '];

/**
 * Authentication middleware for Bearer / OAuth token validation
 * Validates the Authorization header against the tokens accepted for the request
 */

/**
 * Create auth middleware
 * @param {object} config - Configuration object
 * @param {Function} [acceptedTokens] - (request) => string[] tokens accepted for this request;
 *   defaults to the configured access token
 * @returns {Function} - Fastify middleware function
 */
function createAuthMiddleware(config, acceptedTokens = () => [config.auth.accessToken]) {
  return async function authMiddleware(request, reply) {
    const authHeader = request.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
      return reply.status(401).send(metaError(
        2500,
        'An active access token must be used to query information about the current user.'
      ));
    }

    // Graph API accepts both schemes (the Resumable Upload API documents "OAuth")
    const scheme = AUTH_SCHEMES.find(prefix => authHeader.startsWith(prefix));
    if (!scheme) {
      return reply.status(401).send(metaError(
        190,
        'Invalid OAuth access token - Cannot parse access token',
        { error_subcode: INVALID_TOKEN_SUBCODE }
      ));
    }

    // Extract token
    const token = authHeader.substring(scheme.length);

    // Validate token
    if (!token || !acceptedTokens(request).includes(token)) {
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
