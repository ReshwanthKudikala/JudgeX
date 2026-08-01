/**
 * Progressive hint unlock rules (browser session only).
 */

export function canRequestHint(unlockedThrough: number, level: 1 | 2 | 3): boolean {
  if (level === 1) return true;
  return unlockedThrough >= level - 1;
}

export function afterSuccessfulHint(
  unlockedThrough: number,
  level: 1 | 2 | 3,
): number {
  return Math.max(unlockedThrough, level);
}

export function showRevealEditorial(unlockedThrough: number): boolean {
  return unlockedThrough >= 3;
}

export function resetHintProgress(): number {
  return 0;
}
