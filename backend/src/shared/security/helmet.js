// Production Helmet configuration for the JSON API.

/**
 * Build Helmet options for JudgeX API responses.
 * Tuned for a Bearer-token SPA talking to a separate origin API.
 *
 * @param {{ isProduction: boolean }} opts
 */
function buildHelmetOptions({ isProduction }) {
  return {
    // API returns JSON only — deny framing and tighten CSP.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    // Allow cross-origin SPA reads (CORS handles allow-list).
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: false,
    xssFilter: true,
    noSniff: true,
    ieNoOpen: true,
    hidePoweredBy: true,
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    // Restrict powerful browser features on any HTML error pages.
    permissionsPolicy: {
      features: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        fullscreen: [],
      },
    },
  };
}

module.exports = { buildHelmetOptions };
