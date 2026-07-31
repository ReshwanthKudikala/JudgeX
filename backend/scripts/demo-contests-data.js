/**
 * Demo contest catalog for Sprint 39.
 * Times are relative offsets from seed runtime so statuses stay meaningful.
 */

const DEMO_CONTEST_RULES = `Solve problems within the contest duration.
Each problem has equal weight.
Hidden test cases are used for judging.
Final ranking is based on solved count then submission time.
This is a demo contest experience — practice on the linked problems anytime.`;

/**
 * @typedef {Object} DemoContest
 * @property {string} id - Fixed UUID for idempotent upserts
 * @property {string} slug
 * @property {string} title
 * @property {string} description
 * @property {string} rules
 * @property {number} durationMinutes
 * @property {'public'} visibility
 * @property {'past'|'running'|'upcoming'} timing
 * @property {string[]} problemSlugs
 */

/** @type {DemoContest[]} */
const DEMO_CONTESTS = [
  {
    id: '019f5200-0001-7000-8000-000000000001',
    slug: 'weekly-contest-1',
    title: 'Weekly Contest 1',
    description:
      'A classic weekly set covering arithmetic, strings, and arrays. Ideal for warming up your fundamentals.',
    rules: DEMO_CONTEST_RULES,
    durationMinutes: 90,
    visibility: 'public',
    timing: 'past',
    problemSlugs: ['a-plus-b', 'palindrome-number', 'two-sum'],
  },
  {
    id: '019f5200-0001-7000-8000-000000000002',
    slug: 'biweekly-contest-1',
    title: 'Biweekly Contest 1',
    description:
      'A mid-length biweekly challenge focused on number properties and hash maps. Join the running window when available.',
    rules: DEMO_CONTEST_RULES,
    durationMinutes: 120,
    visibility: 'public',
    timing: 'running',
    problemSlugs: ['palindrome-number', 'two-sum'],
  },
  {
    id: '019f5200-0001-7000-8000-000000000003',
    slug: 'beginner-challenge',
    title: 'Beginner Challenge',
    description:
      'A short upcoming contest designed for newcomers — two approachable problems to build confidence.',
    rules: DEMO_CONTEST_RULES,
    durationMinutes: 60,
    visibility: 'public',
    timing: 'upcoming',
    problemSlugs: ['a-plus-b', 'palindrome-number'],
  },
];

/**
 * Compute start/end ISO strings relative to now for a demo timing bucket.
 * @param {'past'|'running'|'upcoming'} timing
 * @param {number} durationMinutes
 * @param {Date} [now]
 */
function resolveContestWindow(timing, durationMinutes, now = new Date()) {
  const ms = durationMinutes * 60 * 1000;
  const t = now.getTime();

  if (timing === 'past') {
    // Ended ~7 days ago
    const end = new Date(t - 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - ms);
    return { startTime: start, endTime: end };
  }

  if (timing === 'running') {
    // Started 30 minutes ago; still within duration window
    const elapsed = Math.min(30 * 60 * 1000, Math.floor(ms / 3));
    const start = new Date(t - elapsed);
    const end = new Date(start.getTime() + ms);
    return { startTime: start, endTime: end };
  }

  // Upcoming — starts in ~3 days
  const start = new Date(t + 3 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + ms);
  return { startTime: start, endTime: end };
}

module.exports = {
  DEMO_CONTESTS,
  DEMO_CONTEST_RULES,
  resolveContestWindow,
};
