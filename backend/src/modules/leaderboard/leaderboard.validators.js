// Query validation for leaderboard list / rank endpoints.
// Ranking order is fixed server-side — not client-configurable.

const { z } = require('zod');

const TIMEFRAME = z.enum(['all', 'monthly', 'weekly']).default('all');

const listLeaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  timeframe: TIMEFRAME.optional(),
});

const userRankQuerySchema = z.object({
  timeframe: TIMEFRAME.optional(),
});

const userRankParamsSchema = z.object({
  userId: z.string().uuid(),
});

module.exports = {
  listLeaderboardQuerySchema,
  userRankQuerySchema,
  userRankParamsSchema,
};
