import { useQuery } from '@tanstack/react-query';

import { getProblemStatistics } from '@/api/problem.api';

export const problemStatisticsQueryKey = (slug: string) =>
  ['problem-statistics', slug] as const;

export function useProblemStatistics(slug: string | undefined) {
  return useQuery({
    queryKey: problemStatisticsQueryKey(slug ?? ''),
    queryFn: () => getProblemStatistics(slug!),
    enabled: Boolean(slug),
    staleTime: 15_000,
  });
}
