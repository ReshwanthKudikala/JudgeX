export type CoachAction =
  | 'EXPLAIN_CODE'
  | 'REVIEW'
  | 'COMPLEXITY'
  | 'COMPILE_ERROR'
  | 'WRONG_ANSWER'
  | 'OPTIMIZE'
  | 'HINT'
  | 'UNKNOWN';

/** @deprecated Prefer CoachAction — kept for older learning-assist paths. */
export type AiAssistAction =
  | 'ask'
  | 'explain_code'
  | 'explain_verdict'
  | 'why_failed'
  | 'optimize'
  | 'suggest_optimizations'
  | 'complexity'
  | 'analyze_complexity'
  | 'hint'
  | 'generate_hint'
  | 'reveal_solution'
  | CoachAction;

export interface AiLearningReply {
  action?: string;
  submissionId?: string;
  problemId?: string;
  reply: string;
  summary: string;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  hintLevel: number | null;
  wasBlocked: boolean;
}

export interface CoachReply {
  answer: string;
  provider: string;
  model: string;
  tokensUsed: number | null;
  durationMs: number;
  format?: 'markdown';
  hintLevel?: number | null;
  action?: CoachAction | string;
}

export interface CoachLastRunResult {
  status?: string | null;
  compileSuccess?: boolean | null;
  stderr?: string | null;
  compile?: {
    success?: boolean | null;
    stdout?: string | null;
    stderr?: string | null;
  } | null;
  results?: Array<{
    index?: number | null;
    status?: string | null;
    passed?: boolean | null;
    input?: string | null;
    expectedOutput?: string | null;
    actualOutput?: string | null;
    stderr?: string | null;
    runtimeMs?: number | null;
  }>;
  passedCount?: number | null;
  totalCount?: number | null;
}

export interface CoachLastSubmission {
  id?: string | null;
  status?: string | null;
  verdict?: string | null;
  compileOutput?: string | null;
  stderr?: string | null;
  executionError?: string | null;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  passedTests?: number | null;
  totalTests?: number | null;
  failedTestIndex?: number | null;
}

export interface CoachRequest {
  problemId: string;
  language: 'python' | 'cpp';
  code: string;
  action: CoachAction | string;
  message?: string;
  hintLevel?: 1 | 2 | 3 | null;
  lastRunResult?: CoachLastRunResult | null;
  lastSubmission?: CoachLastSubmission | null;
}

export interface AiLearningAssistInput {
  action: AiAssistAction;
  problemId?: string;
  submissionId?: string;
  language?: 'python' | 'cpp';
  sourceCode?: string;
  message?: string;
  hintLevel?: 1 | 2 | 3 | 4;
  revealSolution?: boolean;
}

export interface AiConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  hintLevel?: number | null;
  wasBlocked?: boolean;
  /** Coach action that produced this turn (assistant) or was requested (user). */
  action?: CoachAction | null;
  createdAt: string;
}

/** Last successful / attempted coach request — used for Regenerate. */
export interface CoachLastRequest {
  action: CoachAction;
  message: string;
  label: string;
  hintLevel?: 1 | 2 | 3;
}
