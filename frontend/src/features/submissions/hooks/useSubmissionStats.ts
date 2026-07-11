import { useQuery } from '@tanstack/react-query';

import { getSubmissionStats } from '@/api/submissions.api';

export const submissionStatsQueryKey = ['submissions', 'stats'] as const;

/** Current user progress for the profile page. */
export function useSubmissionStats(enabled = true) {
  return useQuery({
    queryKey: submissionStatsQueryKey,
    queryFn: getSubmissionStats,
    enabled,
    staleTime: 30_000,
  });
}
