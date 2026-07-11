import { apiClient, unwrapData, unwrapEnvelope } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type {
  CreateCommentInput,
  CreateDiscussionInput,
  DiscussionComment,
  DiscussionDetail,
  DiscussionListParams,
  DiscussionListResult,
  DiscussionReport,
  DiscussionSummary,
  UpdateDiscussionInput,
} from '@/types/discussions';

export async function listProblemDiscussions(
  slug: string,
  params: DiscussionListParams = {},
): Promise<DiscussionListResult> {
  const { data, meta } = await unwrapEnvelope(
    apiClient.get<ApiEnvelope<DiscussionSummary[]>>(
      `/problems/${encodeURIComponent(slug)}/discussions`,
      { params },
    ),
  );
  return {
    discussions: Array.isArray(data) ? data : [],
    pagination: (meta.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: Array.isArray(data) ? data.length : 0,
      totalPages: 1,
    }) as DiscussionListResult['pagination'],
  };
}

export async function createProblemDiscussion(
  slug: string,
  input: CreateDiscussionInput,
): Promise<DiscussionDetail> {
  return unwrapData(
    apiClient.post<ApiEnvelope<DiscussionDetail>>(
      `/problems/${encodeURIComponent(slug)}/discussions`,
      input,
    ),
  );
}

export async function getDiscussion(id: string): Promise<DiscussionDetail> {
  return unwrapData(
    apiClient.get<ApiEnvelope<DiscussionDetail>>(
      `/discussions/${encodeURIComponent(id)}`,
    ),
  );
}

export async function updateDiscussion(
  id: string,
  input: UpdateDiscussionInput,
): Promise<DiscussionDetail> {
  return unwrapData(
    apiClient.patch<ApiEnvelope<DiscussionDetail>>(
      `/discussions/${encodeURIComponent(id)}`,
      input,
    ),
  );
}

export async function deleteDiscussion(id: string): Promise<{ id: string; deleted: boolean }> {
  return unwrapData(
    apiClient.delete<ApiEnvelope<{ id: string; deleted: boolean }>>(
      `/discussions/${encodeURIComponent(id)}`,
    ),
  );
}

export async function createComment(
  discussionId: string,
  input: CreateCommentInput,
): Promise<DiscussionComment> {
  return unwrapData(
    apiClient.post<ApiEnvelope<DiscussionComment>>(
      `/discussions/${encodeURIComponent(discussionId)}/comments`,
      input,
    ),
  );
}

export async function updateComment(
  id: string,
  body: string,
): Promise<DiscussionComment> {
  return unwrapData(
    apiClient.patch<ApiEnvelope<DiscussionComment>>(
      `/comments/${encodeURIComponent(id)}`,
      { body },
    ),
  );
}

export async function deleteComment(
  id: string,
): Promise<{ id: string; deleted: boolean }> {
  return unwrapData(
    apiClient.delete<ApiEnvelope<{ id: string; deleted: boolean }>>(
      `/comments/${encodeURIComponent(id)}`,
    ),
  );
}

export async function reportDiscussion(
  id: string,
  reason: string,
): Promise<DiscussionReport> {
  return unwrapData(
    apiClient.post<ApiEnvelope<DiscussionReport>>(
      `/discussions/${encodeURIComponent(id)}/report`,
      { reason },
    ),
  );
}

export async function reportComment(
  id: string,
  reason: string,
): Promise<DiscussionReport> {
  return unwrapData(
    apiClient.post<ApiEnvelope<DiscussionReport>>(
      `/comments/${encodeURIComponent(id)}/report`,
      { reason },
    ),
  );
}
