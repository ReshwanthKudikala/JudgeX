import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { getContestScoreboard } from '@/api/contests.api';

export const SCOREBOARD_PAGE_SIZE = 20;
export const SCOREBOARD_REFETCH_MS = 30_000;

export const scoreboardQueryKey = (
  id: string,
  page: number,
  limit: number,
) => ['contest', id, 'scoreboard', { page, limit }] as const;

export function useContestScoreboard(
  contestId: string | undefined,
  options: { live?: boolean } = {},
) {
  const { live = false } = options;
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: scoreboardQueryKey(contestId ?? '', page, SCOREBOARD_PAGE_SIZE),
    queryFn: () =>
      getContestScoreboard(contestId!, {
        page,
        limit: SCOREBOARD_PAGE_SIZE,
      }),
    enabled: Boolean(contestId),
    placeholderData: keepPreviousData,
    staleTime: live ? 5_000 : 15_000,
    refetchInterval: live ? SCOREBOARD_REFETCH_MS : false,
  });

  const onPageChange = useCallback((next: number) => {
    setPage(Math.max(1, next));
  }, []);

  return {
    entries: query.data?.entries ?? [],
    pagination: query.data?.pagination ?? {
      page,
      limit: SCOREBOARD_PAGE_SIZE,
      total: 0,
      totalPages: 0,
    },
    participantCount: query.data?.participantCount ?? 0,
    status: query.data?.status,
    page,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    onPageChange,
  };
}
