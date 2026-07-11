import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { listContests } from '@/api/contests.api';
import type { ContestStatus } from '@/types/contests';

export const CONTESTS_PAGE_SIZE = 20;

export const contestsQueryKey = (params: {
  page: number;
  limit: number;
  status?: ContestStatus;
}) => ['contests', params] as const;

export function useContests(status?: ContestStatus | 'all') {
  const [page, setPage] = useState(1);

  const queryParams = useMemo(
    () => ({
      page,
      limit: CONTESTS_PAGE_SIZE,
      status: status && status !== 'all' ? status : undefined,
    }),
    [page, status],
  );

  const query = useQuery({
    queryKey: contestsQueryKey(queryParams),
    queryFn: () => listContests(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const onPageChange = useCallback((next: number) => {
    setPage(Math.max(1, next));
  }, []);

  return {
    contests: query.data?.contests ?? [],
    pagination: query.data?.pagination ?? {
      page,
      limit: CONTESTS_PAGE_SIZE,
      total: 0,
      totalPages: 0,
    },
    page,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    onPageChange,
    setPage,
  };
}
