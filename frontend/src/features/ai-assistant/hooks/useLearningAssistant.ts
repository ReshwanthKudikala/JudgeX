import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { askCoach } from '@/api/ai.api';
import {
  afterSuccessfulHint,
  resetHintProgress,
} from '@/features/ai-assistant/hint-progress';
import type {
  AiConversationMessage,
  CoachAction,
  CoachLastRequest,
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

const REVEAL_EDITORIAL_MESSAGE =
  'Would you like to open the Editorial instead?';

function emptyCodeHint(action: CoachAction): string {
  if (action === 'REVIEW') {
    return 'Write some code in the editor first, then click “Review My Solution” for interviewer-style feedback.';
  }
  if (action === 'EXPLAIN_CODE') {
    return 'Write some code in the editor first, then click “Explain My Code” and I will walk through your solution.';
  }
  if (action === 'OPTIMIZE') {
    return 'Write some code in the editor first, then click “Optimize My Solution”.';
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
 * Conversation + progressive hint unlock for the current problem session.
 * Messages persist across Workspace ↔ AI Coach tab switches (panel stays mounted).
 */
export function useLearningAssistant({
  problemId,
  language,
  getSourceCode,
  getLastRunResult,
  getLastSubmission,
}: UseLearningAssistantOptions) {
  const [messages, setMessages] = useState<AiConversationMessage[]>([]);
  const [hintUnlockedThrough, setHintUnlockedThrough] = useState(0);
  const [lastRequest, setLastRequest] = useState<CoachLastRequest | null>(null);
  const [activeAction, setActiveAction] = useState<CoachAction | null>(null);
  const lastRequestRef = useRef<CoachLastRequest | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CoachRequest) => askCoach(input),
  });

  useEffect(() => {
    setMessages([]);
    setHintUnlockedThrough(resetHintProgress());
    setLastRequest(null);
    lastRequestRef.current = null;
    setActiveAction(null);
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on problem change
  }, [problemId]);

  const clear = useCallback(() => {
    setMessages([]);
    setLastRequest(null);
    lastRequestRef.current = null;
    setActiveAction(null);
    mutation.reset();
  }, [mutation]);

  const ask = useCallback(
    async (params: {
      action: CoachAction;
      message?: string;
      label: string;
      hintLevel?: 1 | 2 | 3;
      /** When regenerating, replace the last assistant reply instead of appending a new user turn. */
      regenerate?: boolean;
    }) => {
      const code = getSourceCode() || '';
      const requestMeta: CoachLastRequest = {
        action: params.action,
        message: params.message || params.label,
        label: params.label,
        hintLevel: params.hintLevel,
      };

      if (
        (params.action === 'EXPLAIN_CODE' ||
          params.action === 'REVIEW' ||
          params.action === 'OPTIMIZE') &&
        !code.trim()
      ) {
        if (params.regenerate) {
          setMessages((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i -= 1) {
              if (next[i].role === 'assistant') {
                next[i] = {
                  ...next[i],
                  content: emptyCodeHint(params.action),
                  action: params.action,
                };
                break;
              }
            }
            return next;
          });
          return null;
        }
        const userMsg: AiConversationMessage = {
          id: newId(),
          role: 'user',
          content: params.label,
          action: params.action,
          createdAt: new Date().toISOString(),
        };
        const assistantMsg: AiConversationMessage = {
          id: newId(),
          role: 'assistant',
          content: emptyCodeHint(params.action),
          action: params.action,
          wasBlocked: false,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        lastRequestRef.current = requestMeta;
        setLastRequest(requestMeta);
        return null;
      }

      if (!params.regenerate) {
        const userMsg: AiConversationMessage = {
          id: newId(),
          role: 'user',
          content: params.label,
          action: params.action,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
      } else {
        // Drop trailing assistant message so loading replaces it.
        setMessages((prev) => {
          const next = [...prev];
          if (next.length && next[next.length - 1].role === 'assistant') {
            next.pop();
          }
          return next;
        });
      }

      lastRequestRef.current = requestMeta;
      setLastRequest(requestMeta);
      setActiveAction(params.action);

      try {
        const reply: CoachReply = await mutation.mutateAsync({
          problemId,
          language,
          code,
          action: params.action,
          message: params.message || params.label,
          hintLevel: params.hintLevel ?? null,
          lastRunResult: getLastRunResult?.() ?? null,
          lastSubmission: getLastSubmission?.() ?? null,
        });

        const assistantMsg: AiConversationMessage = {
          id: newId(),
          role: 'assistant',
          content: reply.answer,
          summary: undefined,
          hintLevel: reply.hintLevel ?? params.hintLevel ?? null,
          action: params.action,
          wasBlocked: false,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (params.action === 'HINT' && params.hintLevel) {
          setHintUnlockedThrough((prev) =>
            afterSuccessfulHint(prev, params.hintLevel!),
          );
        }

        return reply;
      } catch (err) {
        const message = mapCoachError(err);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: message,
            action: params.action,
            wasBlocked: false,
            createdAt: new Date().toISOString(),
          },
        ]);
        throw err;
      } finally {
        setActiveAction(null);
      }
    },
    [mutation, problemId, language, getSourceCode, getLastRunResult, getLastSubmission],
  );

  const regenerate = useCallback(async () => {
    const prev = lastRequestRef.current;
    if (!prev) return null;
    return ask({ ...prev, regenerate: true });
  }, [ask]);

  const revealEditorialPrompt = useCallback(() => {
    const userMsg: AiConversationMessage = {
      id: newId(),
      role: 'user',
      content: 'Reveal Editorial',
      action: 'HINT',
      createdAt: new Date().toISOString(),
    };
    const assistantMsg: AiConversationMessage = {
      id: newId(),
      role: 'assistant',
      content: REVEAL_EDITORIAL_MESSAGE,
      action: 'HINT',
      wasBlocked: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  }, []);

  return {
    messages,
    clear,
    ask,
    regenerate,
    lastRequest,
    revealEditorialPrompt,
    hintUnlockedThrough,
    activeAction,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

export { REVEAL_EDITORIAL_MESSAGE };
