import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { listLeaderboard } from '@/api/leaderboard.api';
import type { LeaderboardTimeframe } from '@/types/leaderboard';

export const LEADERBOARD_PAGE_SIZE = 20;

export const leaderboardQueryKey = (params: {
  page: number;
  limit: number;
  timeframe: LeaderboardTimeframe;
}) => ['leaderboard', params] as const;

export function useLeaderboard() {
  const [page, setPage] = useState(1);
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('all');

  const queryParams = useMemo(
    () => ({
      page,
      limit: LEADERBOARD_PAGE_SIZE,
      timeframe,
    }),
    [page, timeframe],
  );

  const query = useQuery({
    queryKey: leaderboardQueryKey(queryParams),
    queryFn: () => listLeaderboard(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const onTimeframeChange = useCallback((next: LeaderboardTimeframe) => {
    setTimeframe(next);
    setPage(1);
  }, []);

  const onPageChange = useCallback((next: number) => {
    setPage(Math.max(1, next));
  }, []);

  return {
    entries: query.data?.entries ?? [],
    pagination: query.data?.pagination ?? {
      page,
      limit: LEADERBOARD_PAGE_SIZE,
      total: 0,
      totalPages: 0,
    },
    timeframe,
    page,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    onTimeframeChange,
    onPageChange,
  };
}
