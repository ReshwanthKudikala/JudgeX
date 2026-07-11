import { useQuery } from '@tanstack/react-query';

import { getUserRank } from '@/api/leaderboard.api';
import type { LeaderboardTimeframe } from '@/types/leaderboard';
import { ApiError } from '@/types';

export const userRankQueryKey = (
  userId: string,
  timeframe: LeaderboardTimeframe = 'all',
) => ['leaderboard', 'rank', userId, timeframe] as const;

/** Current user's global rank (404 → unranked / null). */
export function useUserRank(
  userId: string | undefined,
  enabled = true,
  timeframe: LeaderboardTimeframe = 'all',
) {
  return useQuery({
    queryKey: userRankQueryKey(userId ?? '', timeframe),
    queryFn: async () => {
      try {
        return await getUserRank(userId!, timeframe);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
    retry: false,
  });
}
