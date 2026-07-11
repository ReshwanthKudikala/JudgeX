// Query validation for leaderboard list endpoints (pagination only).
// Ranking order is fixed server-side — not client-configurable.

const { z } = require('zod');

const listLeaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = { listLeaderboardQuerySchema };
