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

const EMPTY_CODE_HINT =
  'Write some code in the editor first, then ask the coach to explain or review it.';

function emptyCodeHint(action: CoachAction): string {
  if (action === 'REVIEW') {
    return 'Write some code in the editor first, then click “Review My Solution” for interviewer-style feedback.';
  }
  if (action === 'EXPLAIN_CODE') {
    return 'Write some code in the editor first, then click “Explain My Code” and I will walk through your solution.';
  }
  return EMPTY_CODE_HINT;
}

function mapCoachError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'AI_UNAVAILABLE' || err.status === 503) {
      const lower = err.message.toLowerCase();
      if (lower.includes('timed out') || lower.includes('timeout')) {
        return 'The AI coach timed out. Please try again in a moment.';
      }
      return 'The local AI model is unavailable right now. Check that Ollama is running, then try again.';
    }
    if (err.code === 'VALIDATION_ERROR' || err.status === 400) {
      return err.message || EMPTY_CODE_HINT;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'AI request failed.';
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
      const code = getSourceCode() || '';

      if (
        (params.action === 'EXPLAIN_CODE' || params.action === 'REVIEW') &&
        !code.trim()
      ) {
        const userMsg: AiConversationMessage = {
          id: newId(),
          role: 'user',
          content: params.label,
          createdAt: new Date().toISOString(),
        };
        const assistantMsg: AiConversationMessage = {
          id: newId(),
          role: 'assistant',
          content: emptyCodeHint(params.action),
          wasBlocked: false,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        return null;
      }

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
          code,
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
        const message = mapCoachError(err);
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
