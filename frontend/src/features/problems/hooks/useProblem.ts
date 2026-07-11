import { useQuery } from '@tanstack/react-query';

import { getProblemBySlug } from '@/api/problem.api';

/**
 * Fetches a single problem by slug.
 * Query key: `['problem', slug]` — independent of the list cache.
 */
export function useProblem(slug: string | undefined) {
  return useQuery({
    queryKey: ['problem', slug],
    queryFn: () => getProblemBySlug(slug as string),
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}
