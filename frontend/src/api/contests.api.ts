import { apiClient, unwrapData, unwrapEnvelope } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type {
  ContestJoinResult,
  ContestListParams,
  ContestListResult,
  ContestProblemsResult,
  ContestSummary,
  ScoreboardResult,
} from '@/types/contests';

export async function listContests(
  params: ContestListParams = {},
): Promise<ContestListResult> {
  const { data, meta } = await unwrapEnvelope(
    apiClient.get<ApiEnvelope<ContestSummary[]>>('/contests', { params }),
  );
  return {
    contests: Array.isArray(data) ? data : [],
    pagination: (meta.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: Array.isArray(data) ? data.length : 0,
      totalPages: 1,
    }) as ContestListResult['pagination'],
  };
}

export async function getContest(id: string): Promise<ContestSummary> {
  return unwrapData(
    apiClient.get<ApiEnvelope<ContestSummary>>(
      `/contests/${encodeURIComponent(id)}`,
    ),
  );
}

export async function joinContest(id: string): Promise<ContestJoinResult> {
  return unwrapData(
    apiClient.post<ApiEnvelope<ContestJoinResult>>(
      `/contests/${encodeURIComponent(id)}/join`,
    ),
  );
}

export async function getContestProblems(
  id: string,
): Promise<ContestProblemsResult> {
  return unwrapData(
    apiClient.get<ApiEnvelope<ContestProblemsResult>>(
      `/contests/${encodeURIComponent(id)}/problems`,
    ),
  );
}

export async function getContestScoreboard(
  id: string,
  params: { page?: number; limit?: number } = {},
): Promise<ScoreboardResult> {
  const { data, meta } = await unwrapEnvelope(
    apiClient.get<ApiEnvelope<ScoreboardResult['entries']>>(
      `/contests/${encodeURIComponent(id)}/scoreboard`,
      { params },
    ),
  );
  return {
    entries: Array.isArray(data) ? data : [],
    pagination: (meta.pagination ?? {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    }) as ScoreboardResult['pagination'],
    contestId: (meta.contestId as string) ?? id,
    status: (meta.status as ScoreboardResult['status']) ?? 'upcoming',
    participantCount: Number(meta.participantCount ?? 0),
  };
}
