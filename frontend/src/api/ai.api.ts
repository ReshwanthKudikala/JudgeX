import { apiClient, unwrapData } from '@/api/client';
import { consumeCoachSse } from '@/features/ai-assistant/coach-sse.js';
import { useAuthStore } from '@/store/auth.store';
import { ApiError, type ApiEnvelope } from '@/types';
import type { CoachRequest, CoachReply } from '@/types/ai-assistant';

/**
 * Sprint 47 — unified AI Coach (POST /ai/coach).
 * Legacy learning-assist / explain-compile-error clients removed.
 *
 * Local Ollama (e.g. qwen2.5-coder:7b) often needs >30s; keep above AI_TIMEOUT_MS.
 */
const COACH_TIMEOUT_MS = 180_000;

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  'http://localhost:4000/api/v1';

export async function askCoach(input: CoachRequest): Promise<CoachReply> {
  return unwrapData(
    apiClient.post<ApiEnvelope<CoachReply>>('/ai/coach', input, {
      timeout: COACH_TIMEOUT_MS,
    }),
  );
}

export interface CoachStreamDone {
  answer: string;
  incomplete: boolean;
  verification?: string;
  durationMs?: number;
  provider?: string;
  model?: string;
  loadMs?: number | null;
  promptEvalMs?: number | null;
  evalMs?: number | null;
  promptTokens?: number | null;
  outputTokens?: number | null;
}

/**
 * Streams coach tokens. The JSON POST stays available for older clients.
 * `incomplete` means generation stopped early; `answer` still includes
 * sandbox evidence when the server had it.
 */
export async function askCoachStream(
  input: CoachRequest,
  handlers: {
    onToken?: (text: string) => void;
    onDone?: (done: CoachStreamDone) => void;
  },
  signal?: AbortSignal,
): Promise<CoachStreamDone> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${apiBaseUrl}/ai/coach/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const code = body?.error?.code || 'AI_UNAVAILABLE';
    const message = body?.error?.message || 'AI request failed.';
    throw new ApiError(response.status, code, message);
  }
  if (!response.body) {
    throw new ApiError(502, 'AI_UNAVAILABLE', 'The coach stream was empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload: CoachStreamDone | null = null;
  let streamError: string | null = null;

  const take = (event: string, data: { text?: string; message?: string; answer?: string; incomplete?: boolean }) => {
    if (event === 'token' && typeof data.text === 'string') {
      handlers.onToken?.(data.text);
    } else if (event === 'done' && typeof data.answer === 'string') {
      donePayload = data as CoachStreamDone;
      handlers.onDone?.(donePayload);
    } else if (event === 'error') {
      streamError = typeof data.message === 'string' ? data.message : 'The coach stream failed.';
    }
  };

  while (true) {
    const step = await reader.read();
    buffer += decoder.decode(step.value || new Uint8Array(), { stream: !step.done });
    buffer = consumeCoachSse(buffer, take);
    if (step.done) break;
  }
  if (buffer.trim()) {
    consumeCoachSse(`${buffer}\n\n`, take);
  }
  if (donePayload) return donePayload;
  throw new ApiError(
    502,
    'AI_UNAVAILABLE',
    streamError || 'The coach stream ended before a complete answer.',
  );
}
