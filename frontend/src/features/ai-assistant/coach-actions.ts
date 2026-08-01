import type {
  CoachAction,
  CoachLastRunResult,
  CoachLastSubmission,
} from '@/types/ai-assistant';
import { isLatestWrongAnswer } from '@/features/ai-assistant/wrong-answer-visibility';

export interface CoachQuickAction {
  label: string;
  action: CoachAction;
  message: string;
}

const EXPLAIN_CODE: CoachQuickAction = {
  label: 'Explain My Code',
  action: 'EXPLAIN_CODE',
  message: 'Explain my current code in the context of this problem.',
};

const REVIEW: CoachQuickAction = {
  label: 'Review My Solution',
  action: 'REVIEW',
  message: 'Review my solution like an experienced technical interviewer.',
};

const OPTIMIZE: CoachQuickAction = {
  label: 'Optimize My Solution',
  action: 'OPTIMIZE',
  message:
    'Optimize my solution: analyze complexity, scalability, and alternatives without rewriting my entire code.',
};

const COMPLEXITY: CoachQuickAction = {
  label: 'Complexity analysis',
  action: 'COMPLEXITY',
  message: 'Analyze the time and space complexity of my code.',
};

const COMPILE_ERROR: CoachQuickAction = {
  label: 'Explain Compile Error',
  action: 'COMPILE_ERROR',
  message: 'Help me understand the compile or interpreter error.',
};

const WRONG_ANSWER: CoachQuickAction = {
  label: 'Debug Wrong Answer',
  action: 'WRONG_ANSWER',
  message:
    'Debug my Wrong Answer using public testcase expected vs actual output. Do not rewrite my solution.',
};

function isAccepted(
  run: CoachLastRunResult | null | undefined,
  sub: CoachLastSubmission | null | undefined,
): boolean {
  const runOk =
    typeof run?.status === 'string' &&
    ['accepted', 'passed', 'ok', 'success'].includes(run.status.toLowerCase());
  const subOk =
    typeof sub?.verdict === 'string' &&
    sub.verdict.toLowerCase() === 'accepted';
  return Boolean(runOk || subOk);
}

function isCompileError(
  run: CoachLastRunResult | null | undefined,
  sub: CoachLastSubmission | null | undefined,
): boolean {
  const runCe =
    typeof run?.status === 'string' &&
    run.status.toLowerCase().replace(/[\s-]+/g, '_') === 'compile_error';
  const runFail = run?.compileSuccess === false;
  const subCe =
    typeof sub?.verdict === 'string' &&
    sub.verdict.toLowerCase().replace(/[\s-]+/g, '_') === 'compile_error';
  return Boolean(runCe || runFail || subCe);
}

/**
 * Context-aware primary chips for the AI Coach panel.
 */
export function getVisibleCoachActions(
  run: CoachLastRunResult | null | undefined,
  sub: CoachLastSubmission | null | undefined,
): CoachQuickAction[] {
  if (isCompileError(run, sub)) {
    return [COMPILE_ERROR, EXPLAIN_CODE, REVIEW];
  }

  if (isLatestWrongAnswer(run, sub)) {
    return [WRONG_ANSWER, REVIEW, EXPLAIN_CODE];
  }

  if (isAccepted(run, sub)) {
    return [OPTIMIZE, REVIEW, EXPLAIN_CODE, COMPLEXITY];
  }

  // Default / idle / partial progress
  return [EXPLAIN_CODE, REVIEW, OPTIMIZE, COMPLEXITY];
}

/**
 * Guided follow-ups after a successful coach reply.
 */
export function getFollowUpActions(lastAction: CoachAction | null | undefined): CoachQuickAction[] {
  switch (lastAction) {
    case 'EXPLAIN_CODE':
      return [REVIEW, OPTIMIZE];
    case 'REVIEW':
      return [OPTIMIZE, EXPLAIN_CODE];
    case 'WRONG_ANSWER':
      return [EXPLAIN_CODE, REVIEW];
    case 'COMPILE_ERROR':
      return [EXPLAIN_CODE, REVIEW];
    case 'OPTIMIZE':
      return [REVIEW, COMPLEXITY, EXPLAIN_CODE];
    case 'COMPLEXITY':
      return [OPTIMIZE, REVIEW];
    case 'HINT':
      return [EXPLAIN_CODE, REVIEW];
    default:
      return [EXPLAIN_CODE, REVIEW, OPTIMIZE];
  }
}

export function loadingLabelForAction(
  action: CoachAction | null | undefined,
  hintLevel?: number | null,
  userLabel?: string | null,
): string {
  if (action === 'HINT' && hintLevel) return `Preparing Hint ${hintLevel}…`;
  if (userLabel?.startsWith('Hint')) return `Preparing ${userLabel}…`;

  switch (action) {
    case 'REVIEW':
      return 'Reviewing your solution…';
    case 'EXPLAIN_CODE':
      return 'Explaining your code…';
    case 'COMPLEXITY':
      return 'Analyzing complexity…';
    case 'WRONG_ANSWER':
      return 'Looking for possible bugs…';
    case 'COMPILE_ERROR':
      return 'Explaining the compile error…';
    case 'OPTIMIZE':
      return 'Optimizing your solution…';
    case 'HINT':
      return 'Preparing your hint…';
    default:
      return 'Thinking…';
  }
}

export { COMPILE_ERROR as COMPILE_ERROR_ACTION };
