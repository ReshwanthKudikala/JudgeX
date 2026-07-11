import { useQuery } from '@tanstack/react-query';

import { getProblemEditorial } from '@/api/editorials.api';
import { ApiError } from '@/types';

/**
 * Fetch published editorial for a problem slug.
 * 404 is treated as "not available" (null data, not an error).
 */
export function useEditorial(slug: string | undefined) {
  return useQuery({
    queryKey: ['editorial', slug],
    queryFn: async () => {
      try {
        return await getProblemEditorial(slug as string);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
