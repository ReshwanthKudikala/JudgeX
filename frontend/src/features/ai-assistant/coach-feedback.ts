const FEEDBACK_KEY = 'judgex.ai-coach.feedback.v1';

export type CoachFeedbackValue = 'helpful' | 'not_helpful';

type FeedbackMap = Record<string, CoachFeedbackValue>;

function readMap(): FeedbackMap {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as FeedbackMap;
  } catch {
    return {};
  }
}

function writeMap(map: FeedbackMap) {
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getCoachFeedback(messageId: string): CoachFeedbackValue | null {
  const map = readMap();
  return map[messageId] ?? null;
}

export function setCoachFeedback(
  messageId: string,
  value: CoachFeedbackValue,
): CoachFeedbackValue {
  const map = readMap();
  map[messageId] = value;
  writeMap(map);
  return value;
}
