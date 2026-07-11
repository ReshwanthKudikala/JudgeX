// CORS origin allow-list helper. Credentials enabled for future cookie auth;
// MVP auth uses Authorization Bearer (CSRF-resistant). See docs/SECURITY.md.

/**
 * @param {string[]} allowedOrigins
 * @returns {import('cors').CorsOptions}
 */
function buildCorsOptions(allowedOrigins) {
  const allowSet = new Set(allowedOrigins);

  return {
    origin(origin, callback) {
      // Non-browser clients (curl, server-to-server, same-origin) send no Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowSet.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Request-ID'],
    exposedHeaders: [
      'X-Correlation-Id',
      'X-Request-ID',
      'Retry-After',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 600,
  };
}

module.exports = { buildCorsOptions };
