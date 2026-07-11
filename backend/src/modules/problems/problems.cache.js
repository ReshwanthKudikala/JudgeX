// Redis cache for published problem details (by slug).

const {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelByPattern,
} = require('../../infrastructure/cache/json-cache');

const TTL_SECONDS = 120;
const PREFIX = 'problem:detail:slug:';
const LIST_PREFIX = 'problem:list:v1:';

function detailKey(slug) {
  return `${PREFIX}${slug}`;
}

function listKey(filters = {}) {
  const {
    page = 1,
    limit = 20,
    sort = '',
    difficulty = '',
    isPublished = '',
    createdBy = '',
  } = filters;
  return `${LIST_PREFIX}p${page}:l${limit}:s${sort}:d${difficulty}:pub${isPublished}:by${createdBy}`;
}

async function getCachedProblemDetail(slug) {
  return cacheGet('problem', detailKey(slug));
}

async function setCachedProblemDetail(slug, payload) {
  return cacheSet('problem', detailKey(slug), payload, TTL_SECONDS);
}

async function getCachedProblemList(filters) {
  return cacheGet('problem', listKey(filters));
}

async function setCachedProblemList(filters, payload) {
  return cacheSet('problem', listKey(filters), payload, 60);
}

async function invalidateProblemDetail(slug) {
  if (slug) await cacheDel(detailKey(slug));
  await cacheDelByPattern(`${LIST_PREFIX}*`);
}

async function invalidateAllProblemLists() {
  await cacheDelByPattern(`${LIST_PREFIX}*`);
}

module.exports = {
  TTL_SECONDS,
  getCachedProblemDetail,
  setCachedProblemDetail,
  getCachedProblemList,
  setCachedProblemList,
  invalidateProblemDetail,
  invalidateAllProblemLists,
};
