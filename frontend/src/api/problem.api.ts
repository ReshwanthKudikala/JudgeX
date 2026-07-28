import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { ProblemDetail, ProblemStatistics } from '@/types/problems';

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

/** GET /problems/:slug/statistics — live submission aggregates. */
export async function getProblemStatistics(
  slug: string,
): Promise<ProblemStatistics> {
  return unwrapData(
    apiClient.get<ApiEnvelope<ProblemStatistics>>(
      `/problems/${encodeURIComponent(slug)}/statistics`,
    ),
  );
}
