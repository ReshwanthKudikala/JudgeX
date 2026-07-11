import { apiClient, unwrapData, unwrapEnvelope } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type {
  CreateSubmissionInput,
  Submission,
  SubmissionListParams,
  SubmissionListResult,
  UserProgress,
} from '@/types/submissions';

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

/** GET /submissions/:id → full submission. Auth required (owner or admin). */
export async function getSubmissionById(id: string): Promise<Submission> {
  return unwrapData(
    apiClient.get<ApiEnvelope<Submission>>(
      `/submissions/${encodeURIComponent(id)}`,
    ),
  );
}

/** GET /submissions — current user's history. Auth required. */
export async function listSubmissions(
  params: SubmissionListParams = {},
): Promise<SubmissionListResult> {
  const { data, meta } = await unwrapEnvelope(
    apiClient.get<ApiEnvelope<Submission[]>>('/submissions', { params }),
  );
  const pagination = (meta.pagination ?? {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    total: Array.isArray(data) ? data.length : 0,
    totalPages: 1,
  }) as SubmissionListResult['pagination'];

  return {
    submissions: Array.isArray(data) ? data : [],
    pagination,
  };
}

/** GET /submissions/stats — current user progress. Auth required. */
export async function getSubmissionStats(): Promise<UserProgress> {
  return unwrapData(
    apiClient.get<ApiEnvelope<UserProgress>>('/submissions/stats'),
  );
}
