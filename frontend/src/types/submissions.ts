export type SubmissionLanguage = 'cpp' | 'python';

export type SubmissionStatus = 'queued' | 'running' | 'completed' | 'error';

export type SubmissionVerdict =
  | 'accepted'
  | 'wrong_answer'
  | 'tle'
  | 'runtime_error'
  | 'compile_error'
  | 'memory_limit_exceeded'
  | 'internal_error';

/** Nested problem summary on list/detail responses (Sprint 26). */
export interface SubmissionProblemSummary {
  id: string;
  slug: string;
  title: string;
  difficulty?: string;
}

/** POST /submissions body — matches live backend validators. */
export interface CreateSubmissionInput {
  problemId: string;
  language: SubmissionLanguage;
  sourceCode: string;
}

/** Full submission from POST /submissions and GET /submissions/:id. */
export interface Submission {
  id: string;
  userId: string;
  problemId: string;
  language: SubmissionLanguage;
  sourceCode?: string;
  status: SubmissionStatus;
  verdict: SubmissionVerdict | null;
  compileOutput: string | null;
  runtimeMs: number | null;
  /** Alias of runtimeMs from the backend. */
  executionTime?: number | null;
  runtime?: number | null;
  memoryKb: number | null;
  memory?: number | null;
  failedTestIndex: number | null;
  passedTests?: number | null;
  totalTests?: number | null;
  stdout?: string | null;
  stderr?: string | null;
  submittedAt?: string;
  judgedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  problem?: SubmissionProblemSummary;
}

/** List item from GET /submissions (no source / stdout / stderr). */
export type SubmissionSummary = Omit<
  Submission,
  'sourceCode' | 'compileOutput' | 'stdout' | 'stderr'
> & {
  problem?: SubmissionProblemSummary;
};

export interface SubmissionListParams {
  page?: number;
  limit?: number;
  verdict?: SubmissionVerdict;
  language?: SubmissionLanguage;
  problemId?: string;
  /** Problem title search. */
  q?: string;
  sort?: string;
  status?: SubmissionStatus;
}

export interface SubmissionListResult {
  submissions: SubmissionSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserProgress {
  problemsSolved: number;
  totalSubmissions: number;
  totalAccepted: number;
  acceptanceRate: number;
  favouriteLanguage: SubmissionLanguage | string | null;
  recentSubmissions: SubmissionSummary[];
  recentAcceptedProblems: Array<{
    problemId: string;
    slug: string;
    title: string;
    difficulty?: string;
    submittedAt: string;
    submissionId: string;
  }>;
}

export interface AiCompileExplanation {
  explanation: string;
  likelyCause: string;
  possibleFix: string;
  wasBlocked?: boolean;
  provider?: string;
}

export const TERMINAL_VERDICTS = new Set<SubmissionVerdict>([
  'accepted',
  'wrong_answer',
  'tle',
  'runtime_error',
  'compile_error',
  'memory_limit_exceeded',
  'internal_error',
]);

export function isTerminalSubmission(submission: Submission): boolean {
  if (submission.status === 'completed' || submission.status === 'error') {
    return true;
  }
  if (submission.verdict && TERMINAL_VERDICTS.has(submission.verdict)) {
    return true;
  }
  return false;
}

export const VERDICT_LABELS: Record<SubmissionVerdict, string> = {
  accepted: 'Accepted',
  wrong_answer: 'Wrong Answer',
  tle: 'Time Limit Exceeded',
  runtime_error: 'Runtime Error',
  compile_error: 'Compile Error',
  memory_limit_exceeded: 'Memory Limit Exceeded',
  internal_error: 'Internal Error',
};

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  error: 'Failed',
};

export const LANGUAGE_LABELS: Record<SubmissionLanguage, string> = {
  cpp: 'C++',
  python: 'Python',
};
