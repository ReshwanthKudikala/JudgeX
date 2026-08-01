import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { CoachRequest, CoachReply } from '@/types/ai-assistant';

/**
 * Sprint 47 — unified AI Coach (POST /ai/coach).
 * Legacy learning-assist / explain-compile-error clients removed.
 *
 * Local Ollama (e.g. qwen2.5-coder:7b) often needs >30s; keep above AI_TIMEOUT_MS.
 */
const COACH_TIMEOUT_MS = 120_000;

export async function askCoach(input: CoachRequest): Promise<CoachReply> {
  return unwrapData(
    apiClient.post<ApiEnvelope<CoachReply>>('/ai/coach', input, {
      timeout: COACH_TIMEOUT_MS,
    }),
  );
}
