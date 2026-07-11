import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { explainCompileError } from '@/api/ai.api';
import { createSubmission, getSubmissionById } from '@/api/submissions.api';
import type { EditorLanguage } from '@/features/editor/types';
import {
  isTerminalSubmission,
  type AiCompileExplanation,
  type CreateSubmissionInput,
} from '@/types/submissions';
import { ApiError } from '@/types';

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 120_000;

export interface SubmitCodeInput {
  problemId: string;
  language: EditorLanguage;
  sourceCode: string;
}

/**
 * Submit + poll lifecycle. No UI logic.
 * Cancels polling on unmount / reset / terminal verdict.
 */
export function useSubmission() {
  const queryClient = useQueryClient();
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollStartedAtRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Drop active poll target so the query disables immediately on leave.
      setSubmissionId(null);
    };
  }, []);

  const createMutation = useMutation({
    mutationFn: (input: CreateSubmissionInput) => createSubmission(input),
    onSuccess: (submission) => {
      if (!mountedRef.current) return;
      pollStartedAtRef.current = Date.now();
      setPollTimedOut(false);
      setSubmissionId(submission.id);
      queryClient.setQueryData(['submission', submission.id], submission);
      void queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });

  const submissionQuery = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: () => getSubmissionById(submissionId as string),
    enabled: Boolean(submissionId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;
      if (isTerminalSubmission(data)) return false;

      const started = pollStartedAtRef.current ?? Date.now();
      if (Date.now() - started >= POLL_TIMEOUT_MS) {
        // Stop interval; surface timeout via state on next tick.
        queueMicrotask(() => {
          if (mountedRef.current) setPollTimedOut(true);
        });
        return false;
      }
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const submission = submissionQuery.data ?? null;
  const isTerminal = submission ? isTerminalSubmission(submission) : false;
  const isPolling = Boolean(submissionId) && !isTerminal && !pollTimedOut;

  const aiQuery = useQuery({
    queryKey: ['ai-explain', submissionId],
    queryFn: () => explainCompileError(submissionId as string),
    // Sprint 29: never auto-request AI — wait for an explicit user action.
    enabled: false,
    retry: false,
    staleTime: Infinity,
  });

  const requestCompileExplanation = useCallback(() => {
    if (!submissionId || submission?.verdict !== 'compile_error') return;
    void aiQuery.refetch();
  }, [submissionId, submission?.verdict, aiQuery]);

  const submit = useCallback(async (input: SubmitCodeInput) => {
    setPollTimedOut(false);
    pollStartedAtRef.current = null;
    setSubmissionId(null);
    await createMutation.mutateAsync({
      problemId: input.problemId,
      language: input.language,
      sourceCode: input.sourceCode,
    });
  }, [createMutation]);

  const reset = useCallback(() => {
    setSubmissionId(null);
    setPollTimedOut(false);
    pollStartedAtRef.current = null;
    createMutation.reset();
  }, [createMutation]);

  const aiExplanation: AiCompileExplanation | null = aiQuery.data ?? null;
  const aiAvailable =
    submission?.verdict === 'compile_error' &&
    Boolean(aiExplanation) &&
    !aiQuery.isError;

  return {
    submit,
    reset,
    submission,
    submissionId,
    isSubmitting: createMutation.isPending,
    isPolling,
    isTerminal,
    pollTimedOut,
    submitError: createMutation.error,
    pollError: submissionQuery.error,
    aiExplanation,
    aiAvailable,
    aiLoading: aiQuery.isFetching,
    aiError: aiQuery.error,
    requestCompileExplanation,
  };
}

export function getSubmissionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Please sign in to submit code.';
    if (err.status === 503) return 'Judging is temporarily unavailable. Try again shortly.';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Submission failed.';
}
