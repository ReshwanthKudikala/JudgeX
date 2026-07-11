import { apiClient, unwrapEnvelope } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type {
  ProblemListParams,
  ProblemListResult,
  ProblemSummary,
  PaginationMeta,
} from '@/types/problems';

function isPaginationMeta(value: unknown): value is PaginationMeta {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.page === 'number' &&
    typeof v.limit === 'number' &&
    typeof v.total === 'number' &&
    typeof v.totalPages === 'number'
  );
}

function emptyPagination(page = 1, limit = 20): PaginationMeta {
  return { page, limit, total: 0, totalPages: 0 };
}

/**
 * GET /problems — paginated catalog.
 * Query keys match the live backend validators (page, limit, sort, difficulty).
 */
export async function listProblems(
  params: ProblemListParams = {},
): Promise<ProblemListResult> {
  const { data, meta } = await unwrapEnvelope(
    apiClient.get<ApiEnvelope<ProblemSummary[]>>('/problems', {
      params: {
        page: params.page,
        limit: params.limit,
        sort: params.sort,
        difficulty: params.difficulty,
      },
    }),
  );

  const pagination = isPaginationMeta(meta.pagination)
    ? meta.pagination
    : emptyPagination(params.page ?? 1, params.limit ?? 20);

  return {
    problems: Array.isArray(data) ? data : [],
    pagination,
  };
}

/** @deprecated Prefer `@/api/problem.api` — kept as a thin re-export. */
export { getProblemBySlug } from '@/api/problem.api';
