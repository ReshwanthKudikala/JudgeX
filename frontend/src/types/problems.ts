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

/** Example shape from GET /problems/:slug (public samples only). */
export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string | null;
}

/**
 * Full problem from GET /problems/:slug (live backend fields + optional future keys).
 */
export interface ProblemDetail extends ProblemSummary {
  statement: string;
  constraintsText?: string | null;
  createdBy?: string | null;
  /** Public sample cases (is_hidden = false). Absent/hidden cases never appear. */
  examples?: ProblemExample[];
  /** Forward-compatible — not returned by the current detail endpoint. */
  notes?: string | null;
  /** Forward-compatible alias some APIs use instead of constraintsText. */
  constraints?: string | null;
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
