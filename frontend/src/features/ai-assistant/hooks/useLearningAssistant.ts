import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { askCoach } from '@/api/ai.api';
import type {
  AiConversationMessage,
  CoachAction,
  CoachLastRunResult,
  CoachLastSubmission,
  CoachRequest,
  CoachReply,
} from '@/types/ai-assistant';
import { ApiError } from '@/types';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseLearningAssistantOptions {
  problemId: string;
  language: 'python' | 'cpp';
  getSourceCode: () => string;
  submissionId?: string | null;
  getLastRunResult?: () => CoachLastRunResult | null | undefined;
  getLastSubmission?: () => CoachLastSubmission | null | undefined;
}

/**
 * Conversation state for the current problem session only (frontend memory).
 * Backend coach is single request / single response — no DB persistence.
 */
export function useLearningAssistant({
  problemId,
  language,
  getSourceCode,
  getLastRunResult,
  getLastSubmission,
}: UseLearningAssistantOptions) {
  const [messages, setMessages] = useState<AiConversationMessage[]>([]);

  const mutation = useMutation({
    mutationFn: (input: CoachRequest) => askCoach(input),
  });

  const clear = useCallback(() => {
    setMessages([]);
    mutation.reset();
  }, [mutation]);

  const ask = useCallback(
    async (params: {
      action: CoachAction;
      message?: string;
      label: string;
    }) => {
      const userMsg: AiConversationMessage = {
        id: newId(),
        role: 'user',
        content: params.label,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const reply: CoachReply = await mutation.mutateAsync({
          problemId,
          language,
          code: getSourceCode() || '',
          action: params.action,
          message: params.message || params.label,
          lastRunResult: getLastRunResult?.() ?? null,
          lastSubmission: getLastSubmission?.() ?? null,
        });

        const assistantMsg: AiConversationMessage = {
          id: newId(),
          role: 'assistant',
          content: reply.answer,
          summary: undefined,
          wasBlocked: false,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return reply;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'AI request failed.';
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: message,
            wasBlocked: false,
            createdAt: new Date().toISOString(),
          },
        ]);
        throw err;
      }
    },
    [mutation, problemId, language, getSourceCode, getLastRunResult, getLastSubmission],
  );

  return {
    messages,
    clear,
    ask,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
