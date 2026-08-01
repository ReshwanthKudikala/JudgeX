import type {
  CoachLastRunResult,
  CoachLastSubmission,
} from '@/types/ai-assistant';

function normalizeVerdict(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Latest run or submit indicates Wrong Answer. */
export function isLatestWrongAnswer(
  run: CoachLastRunResult | null | undefined,
  submission: CoachLastSubmission | null | undefined,
): boolean {
  if (normalizeVerdict(run?.status) === 'wrong_answer') return true;
  if (normalizeVerdict(submission?.verdict) === 'wrong_answer') return true;
  if (run?.results?.some((r) => r.passed === false)) return true;
  return false;
}
