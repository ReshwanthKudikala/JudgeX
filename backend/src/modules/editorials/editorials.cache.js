// Redis cache for published editorials. Failures never break reads/writes.

const { cacheGet, cacheSet, cacheDel } = require('../../infrastructure/cache/json-cache');

const TTL_SECONDS = 300;
const PREFIX = 'editorial:published:slug:';

function cacheKey(slug) {
  return `${PREFIX}${slug}`;
}

async function getCachedEditorial(slug) {
  return cacheGet('editorial', cacheKey(slug));
}

async function setCachedEditorial(slug, payload) {
  return cacheSet('editorial', cacheKey(slug), payload, TTL_SECONDS);
}

async function invalidateEditorialCache(slug) {
  if (!slug) return;
  await cacheDel(cacheKey(slug));
}

module.exports = {
  TTL_SECONDS,
  getCachedEditorial,
  setCachedEditorial,
  invalidateEditorialCache,
};
