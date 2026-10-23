/**
 * Query keys to refresh once a submission reaches a terminal verdict.
 * `['submissions']` also matches user progress (`['submissions', 'stats']`)
 * because invalidation is prefix-based.
 * @param {string | null | undefined} slug
 * @returns {string[][]}
 */
export function queryKeysToRefreshAfterTerminalVerdict(slug) {
  /** @type {string[][]} */
  const keys = [['submissions']];
  if (typeof slug === 'string' && slug.length > 0) {
    keys.push(['problem-statistics', slug]);
    keys.push(['problem', slug]);
  } else {
    keys.push(['problem-statistics']);
    keys.push(['problem']);
  }
  return keys;
}
