import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { ProblemDetail } from '@/types/problems';

/**
 * GET /problems/:slug — single problem detail.
 * Matches the live backend envelope: `{ success, data: ProblemDetail, … }`.
 */
export async function getProblemBySlug(slug: string): Promise<ProblemDetail> {
  return unwrapData(
    apiClient.get<ApiEnvelope<ProblemDetail>>(
      `/problems/${encodeURIComponent(slug)}`,
    ),
  );
}
