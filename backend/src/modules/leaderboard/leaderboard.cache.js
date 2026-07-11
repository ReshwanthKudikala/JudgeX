// Redis cache for public leaderboard pages.

const {
  cacheGet,
  cacheSet,
  cacheDelByPattern,
} = require('../../infrastructure/cache/json-cache');

const TTL_SECONDS = 30;
const PREFIX = 'leaderboard:v1:';

function listKey({ timeframe, page, limit }) {
  return `${PREFIX}${timeframe || 'all'}:p${page || 1}:l${limit || 20}`;
}

function rankKey(userId, timeframe) {
  return `${PREFIX}rank:${timeframe || 'all'}:${userId}`;
}

async function getCachedLeaderboard(filters) {
  return cacheGet('leaderboard', listKey(filters));
}

async function setCachedLeaderboard(filters, payload) {
  return cacheSet('leaderboard', listKey(filters), payload, TTL_SECONDS);
}

async function getCachedUserRank(userId, timeframe) {
  return cacheGet('leaderboard', rankKey(userId, timeframe));
}

async function setCachedUserRank(userId, timeframe, payload) {
  return cacheSet('leaderboard', rankKey(userId, timeframe), payload, TTL_SECONDS);
}

async function invalidateLeaderboardCache() {
  await cacheDelByPattern(`${PREFIX}*`);
}

module.exports = {
  TTL_SECONDS,
  getCachedLeaderboard,
  setCachedLeaderboard,
  getCachedUserRank,
  setCachedUserRank,
  invalidateLeaderboardCache,
};
