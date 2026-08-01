import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { CoachRequest, CoachReply } from '@/types/ai-assistant';

/**
 * Sprint 47 — unified AI Coach (POST /ai/coach).
 * Legacy learning-assist / explain-compile-error clients removed.
 */
export async function askCoach(input: CoachRequest): Promise<CoachReply> {
  return unwrapData(
    apiClient.post<ApiEnvelope<CoachReply>>('/ai/coach', input),
  );
}
