import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { ProblemEditorial } from '@/types/editorials';

/**
 * GET /problems/:slug/editorial — published editorial only (404 if unavailable).
 */
export async function getProblemEditorial(slug: string): Promise<ProblemEditorial> {
  return unwrapData(
    apiClient.get<ApiEnvelope<ProblemEditorial>>(`/problems/${encodeURIComponent(slug)}/editorial`),
  );
}
