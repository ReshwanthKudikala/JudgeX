// Redis-backed per-user/IP rate limiting (API_SPECIFICATION.md §11.2).
// Tiered presets protect auth, submissions, AI, admin, and contest join.
// Submission GETs are intentionally not limited so status polling stays cheap.

const { config } = require('../config');
const { RateLimitError } = require('../shared/errors/http-errors');
const { logSecurityEvent, clientIp } = require('../shared/security/security-log');
const {
  incrementWindow,
  isRateLimitStoreReady,
} = require('../infrastructure/cache/rate-limit.store');

/** @typedef {'auth'|'submission'|'ai'|'admin'|'contestJoin'|'problems'|'global'} RateLimitTier */

const DEFAULT_PRESETS = Object.freeze({
  auth: { windowMs: 60_000, max: 10, keyBy: 'ip', failClosed: true },
  submission: { windowMs: 60_000, max: 60, keyBy: 'user', failClosed: false },
  ai: { windowMs: 60_000, max: 20, keyBy: 'user', failClosed: false },
  admin: { windowMs: 60_000, max: 120, keyBy: 'user', failClosed: true },
  contestJoin: { windowMs: 60_000, max: 15, keyBy: 'user', failClosed: false },
  problems: { windowMs: 60_000, max: 240, keyBy: 'ip', failClosed: false },
  global: { windowMs: 60_000, max: 100, keyBy: 'ip', failClosed: false },
});

/**
 * Resolve preset overrides from config.security.rateLimit.tiers.
 * @param {RateLimitTier} tier
 */
function resolvePreset(tier) {
  const base = DEFAULT_PRESETS[tier] || DEFAULT_PRESETS.global;
  const override = config.security.rateLimit.tiers?.[tier] || {};
  return {
    ...base,
    ...override,
    tier,
    windowMs: Number(override.windowMs || base.windowMs),
    max: Number(override.max || base.max),
  };
}

function subjectKey(req, keyBy) {
  if (keyBy === 'user' && req.user?.id) {
    return `u:${req.user.id}`;
  }
  return `ip:${clientIp(req) || 'unknown'}`;
}

function setRateLimitHeaders(res, { limit, remaining, resetAt }) {
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
}

/**
 * Factory: Redis fixed-window rate limiter for a named tier.
 *
 * @param {RateLimitTier|Object} tierOrOptions
 * @returns {import('express').RequestHandler}
 */
function rateLimit(tierOrOptions = 'global') {
  const preset =
    typeof tierOrOptions === 'string'
      ? resolvePreset(tierOrOptions)
      : { ...resolvePreset(tierOrOptions.tier || 'global'), ...tierOrOptions };

  return async function rateLimitMiddleware(req, res, next) {
    try {
      if (!config.security.rateLimit.enabled && !preset.force) {
        return next();
      }

      // Keep unit/integration suites free of flaky 429s unless explicitly forced.
      if (config.env === 'test' && !config.security.rateLimit.forceInTest && !preset.force) {
        return next();
      }

      if (!isRateLimitStoreReady()) {
        if (preset.failClosed) {
          logSecurityEvent(
            'security_violation',
            { reason: 'rate_limit_store_unavailable', tier: preset.tier },
            req,
          );
          return next(
            new RateLimitError('Rate limiting temporarily unavailable. Try again shortly.', {
              retryAfterSec: 5,
            }),
          );
        }
        return next();
      }

      const id = subjectKey(req, preset.keyBy);
      const redisKey = `rl:${preset.tier}:${id}`;
      const { count, ttlMs, resetAt } = await incrementWindow(redisKey, preset.windowMs);
      const remaining = preset.max - count;

      setRateLimitHeaders(res, {
        limit: preset.max,
        remaining,
        resetAt,
      });

      if (count > preset.max) {
        const retryAfterSec = Math.max(1, Math.ceil(ttlMs / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        logSecurityEvent(
          'rate_limited',
          { tier: preset.tier, limit: preset.max, count, subject: id },
          req,
        );
        return next(
          new RateLimitError('Too many requests. Please try again later.', {
            retryAfterSec,
            details: { tier: preset.tier },
          }),
        );
      }

      return next();
    } catch (err) {
      if (preset.failClosed) {
        logSecurityEvent(
          'security_violation',
          { reason: 'rate_limit_error', tier: preset.tier, error: err.message },
          req,
        );
        return next(
          new RateLimitError('Rate limiting temporarily unavailable. Try again shortly.', {
            retryAfterSec: 5,
          }),
        );
      }
      // Fail-open for throughput-sensitive paths (submissions/AI) when Redis errors.
      return next();
    }
  };
}

const authRateLimit = rateLimit('auth');
const submissionRateLimit = rateLimit('submission');
const aiRateLimit = rateLimit('ai');
const adminRateLimit = rateLimit('admin');
const contestJoinRateLimit = rateLimit('contestJoin');
const problemsRateLimit = rateLimit('problems');

module.exports = {
  rateLimit,
  resolvePreset,
  authRateLimit,
  submissionRateLimit,
  aiRateLimit,
  adminRateLimit,
  contestJoinRateLimit,
  problemsRateLimit,
  DEFAULT_PRESETS,
};
