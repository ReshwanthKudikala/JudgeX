import { apiClient, unwrapData, unwrapEnvelope } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type {
  LeaderboardEntry,
  LeaderboardListParams,
  LeaderboardListResult,
  LeaderboardTimeframe,
} from '@/types/leaderboard';

/** GET /leaderboard — public paginated rankings. */
export async function listLeaderboard(
  params: LeaderboardListParams = {},
): Promise<LeaderboardListResult> {
  const { data, meta } = await unwrapEnvelope(
    apiClient.get<ApiEnvelope<LeaderboardEntry[]>>('/leaderboard', { params }),
  );

  const pagination = (meta.pagination ?? {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    total: Array.isArray(data) ? data.length : 0,
    totalPages: 1,
  }) as LeaderboardListResult['pagination'];

  const timeframe = (meta.timeframe as LeaderboardTimeframe | undefined) ??
    params.timeframe ??
    'all';

  return {
    entries: Array.isArray(data) ? data : [],
    pagination,
    timeframe,
  };
}

/** GET /leaderboard/users/:userId/rank — public; 404 if unranked. */
export async function getUserRank(
  userId: string,
  timeframe: LeaderboardTimeframe = 'all',
): Promise<LeaderboardEntry> {
  return unwrapData(
    apiClient.get<ApiEnvelope<LeaderboardEntry>>(
      `/leaderboard/users/${encodeURIComponent(userId)}/rank`,
      { params: { timeframe } },
    ),
  );
}
