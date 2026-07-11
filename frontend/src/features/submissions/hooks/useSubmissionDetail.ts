import { useQuery } from '@tanstack/react-query';

import { getSubmissionById } from '@/api/submissions.api';
import { explainCompileError } from '@/api/ai.api';

export const submissionDetailQueryKey = (id: string) =>
  ['submission', id] as const;

/**
 * Load a single submission (owner/admin) with optional AI explanation for CE.
 */
export function useSubmissionDetail(submissionId: string | undefined) {
  const detailQuery = useQuery({
    queryKey: submissionDetailQueryKey(submissionId ?? ''),
    queryFn: () => getSubmissionById(submissionId!),
    enabled: Boolean(submissionId),
    staleTime: 10_000,
  });

  const isCompileError = detailQuery.data?.verdict === 'compile_error';

  const aiQuery = useQuery({
    queryKey: ['ai-compile-explanation', submissionId],
    queryFn: () => explainCompileError(submissionId!),
    // Sprint 29: only fetch when explicitly requested via refetch.
    enabled: false,
    staleTime: 60_000,
    retry: false,
  });

  return {
    submission: detailQuery.data ?? null,
    isLoading: detailQuery.isLoading,
    isError: detailQuery.isError,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
    aiExplanation: aiQuery.data ?? null,
    aiLoading: aiQuery.isFetching,
    aiAvailable: Boolean(aiQuery.data) && !aiQuery.isError,
    requestCompileExplanation: () => {
      if (!submissionId || !isCompileError) return;
      void aiQuery.refetch();
    },
  };
}
