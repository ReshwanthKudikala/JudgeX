// Redis cache for public contest list pages (viewer-agnostic payload).

const {
  cacheGet,
  cacheSet,
  cacheDelByPattern,
} = require('../../infrastructure/cache/json-cache');

const TTL_SECONDS = 20;
const PREFIX = 'contest:list:v1:';

function listKey(filters = {}) {
  const { page = 1, limit = 20, status = '', sort = '' } = filters;
  return `${PREFIX}p${page}:l${limit}:st${status}:so${sort}`;
}

async function getCachedContestList(filters) {
  return cacheGet('contest', listKey(filters));
}

async function setCachedContestList(filters, payload) {
  return cacheSet('contest', listKey(filters), payload, TTL_SECONDS);
}

async function invalidateContestListCache() {
  await cacheDelByPattern(`${PREFIX}*`);
}

module.exports = {
  TTL_SECONDS,
  getCachedContestList,
  setCachedContestList,
  invalidateContestListCache,
};
