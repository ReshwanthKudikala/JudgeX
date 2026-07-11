export type SubmissionLanguage = 'cpp' | 'python';

export type SubmissionStatus = 'queued' | 'running' | 'completed' | 'error';

export type SubmissionVerdict =
  | 'accepted'
  | 'wrong_answer'
  | 'tle'
  | 'runtime_error'
  | 'compile_error';

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
  memoryKb: number | null;
  failedTestIndex: number | null;
  submittedAt?: string;
  judgedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
};

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  error: 'Failed',
};
