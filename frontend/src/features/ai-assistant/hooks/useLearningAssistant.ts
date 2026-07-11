import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { learningAssist } from '@/api/ai.api';
import type {
  AiAssistAction,
  AiConversationMessage,
  AiLearningAssistInput,
  AiLearningReply,
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
}

/**
 * Conversation state for the current problem session only.
 * AI is never requested until the user triggers an action.
 */
export function useLearningAssistant({
  problemId,
  language,
  getSourceCode,
  submissionId,
}: UseLearningAssistantOptions) {
  const [messages, setMessages] = useState<AiConversationMessage[]>([]);

  const mutation = useMutation({
    mutationFn: (input: AiLearningAssistInput) => learningAssist(input),
  });

  const clear = useCallback(() => {
    setMessages([]);
    mutation.reset();
  }, [mutation]);

  const ask = useCallback(
    async (params: {
      action: AiAssistAction;
      message?: string;
      hintLevel?: 1 | 2 | 3 | 4;
      revealSolution?: boolean;
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
        const reply: AiLearningReply = await mutation.mutateAsync({
          action: params.action,
          problemId,
          language,
          sourceCode: getSourceCode() || undefined,
          submissionId: submissionId || undefined,
          message: params.message,
          hintLevel: params.hintLevel,
          revealSolution: params.revealSolution,
        });

        const assistantMsg: AiConversationMessage = {
          id: newId(),
          role: 'assistant',
          content: reply.reply,
          summary: reply.summary,
          timeComplexity: reply.timeComplexity,
          spaceComplexity: reply.spaceComplexity,
          hintLevel: reply.hintLevel,
          wasBlocked: reply.wasBlocked,
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
    [mutation, problemId, language, getSourceCode, submissionId],
  );

  return {
    messages,
    clear,
    ask,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
