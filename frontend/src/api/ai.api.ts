import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { AiCompileExplanation } from '@/types/submissions';

/**
 * POST /ai/explain-compile-error
 * Body: `{ submissionId }` — only valid when verdict is compile_error.
 */
export async function explainCompileError(
  submissionId: string,
): Promise<AiCompileExplanation> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AiCompileExplanation>>(
      '/ai/explain-compile-error',
      { submissionId },
    ),
  );
}
