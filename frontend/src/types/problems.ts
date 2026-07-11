export type ProblemDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Catalog summary from GET /problems.
 * Optional fields (tags, solvedByMe) are typed for forward compatibility —
 * the current backend summary omits them.
 */
export interface ProblemSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  totalSubmissions: number;
  totalAccepted: number;
  acceptanceRate: number;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Present when the API starts returning tags. */
  tags?: string[];
  /** Present when the API starts returning per-user solve state. */
  solvedByMe?: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ProblemSortField = 'title' | 'difficulty' | 'acceptance';
export type SortDirection = 'asc' | 'desc';

export interface ProblemListParams {
  page?: number;
  limit?: number;
  /** Backend allow-list: title | difficulty | totalAccepted | … */
  sort?: string;
  difficulty?: ProblemDifficulty;
}

export interface ProblemListResult {
  problems: ProblemSummary[];
  pagination: PaginationMeta;
}
