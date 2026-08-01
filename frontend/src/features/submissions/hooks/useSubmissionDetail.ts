import { useMutation, useQuery } from '@tanstack/react-query';

import { askCoach } from '@/api/ai.api';
import { getSubmissionById } from '@/api/submissions.api';
import { COMPILE_ERROR_ACTION } from '@/features/ai-assistant/coach-actions';
import type { CoachReply } from '@/types/ai-assistant';

export const submissionDetailQueryKey = (id: string) =>
  ['submission', id] as const;

/**
 * Load a single submission (owner/admin).
 * Compile-error help uses the unified AI Coach endpoint.
 */
export function useSubmissionDetail(submissionId: string | undefined) {
  const detailQuery = useQuery({
    queryKey: submissionDetailQueryKey(submissionId ?? ''),
    queryFn: () => getSubmissionById(submissionId!),
    enabled: Boolean(submissionId),
    staleTime: 10_000,
  });

  const submission = detailQuery.data ?? null;
  const isCompileError = submission?.verdict === 'compile_error';

  const coachMutation = useMutation({
    mutationFn: async (): Promise<CoachReply> => {
      if (!submission) throw new Error('Submission not loaded');
      const language = (submission.language === 'cpp' ? 'cpp' : 'python') as
        | 'python'
        | 'cpp';
      const problemId =
        submission.problemId ||
        submission.problem?.id ||
        '';
      if (!problemId) throw new Error('Missing problem id for AI Coach');

      return askCoach({
        problemId,
        language,
        code: submission.sourceCode ?? '',
        action: COMPILE_ERROR_ACTION.action,
        message: COMPILE_ERROR_ACTION.message,
        lastSubmission: {
          id: submission.id,
          status: submission.status ?? null,
          verdict: submission.verdict ?? null,
          compileOutput: submission.compileOutput ?? null,
          stderr: submission.stderr ?? null,
          executionError: submission.executionError ?? null,
          runtimeMs: submission.runtimeMs ?? submission.executionTime ?? null,
          memoryKb: submission.memoryKb ?? null,
          passedTests: submission.passedTests ?? null,
          totalTests: submission.totalTests ?? null,
          failedTestIndex: submission.failedTestIndex ?? null,
        },
      });
    },
  });

  return {
    submission,
    isLoading: detailQuery.isLoading,
    isError: detailQuery.isError,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
    coachAnswer: coachMutation.data?.answer ?? null,
    coachLoading: coachMutation.isPending,
    coachError: coachMutation.error,
    requestCompileExplanation: () => {
      if (!submissionId || !isCompileError) return;
      void coachMutation.mutateAsync();
    },
  };
}
