import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { CreateSubmissionInput, Submission } from '@/types/submissions';

/** POST /submissions → 202 Submission (queued). Auth required. */
export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<Submission> {
  return unwrapData(
    apiClient.post<ApiEnvelope<Submission>>('/submissions', {
      problemId: input.problemId,
      language: input.language,
      sourceCode: input.sourceCode,
    }),
  );
}

/** GET /submissions/:id → full submission (used for polling). Auth required. */
export async function getSubmissionById(id: string): Promise<Submission> {
  return unwrapData(
    apiClient.get<ApiEnvelope<Submission>>(
      `/submissions/${encodeURIComponent(id)}`,
    ),
  );
}
