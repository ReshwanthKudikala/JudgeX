// Contest domain helpers (status derivation, DTOs).

const PENALTY_MINUTES_PER_WRONG = 20;

/**
 * Derive contest lifecycle status from wall-clock times.
 * @param {{ start_time: Date|string, end_time: Date|string }} row
 * @param {Date} [now]
 */
function deriveContestStatus(row, now = new Date()) {
  const start = new Date(row.start_time).getTime();
  const end = new Date(row.end_time).getTime();
  const t = now.getTime();
  if (t < start) return 'upcoming';
  if (t < end) return 'running';
  return 'ended';
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toContestSummary(row, extras = {}) {
  const status = deriveContestStatus(row);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    visibility: row.visibility,
    status,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participantCount: extras.participantCount ?? toNumber(row.participant_count),
    problemCount: extras.problemCount ?? toNumber(row.problem_count),
    joined: extras.joined ?? false,
  };
}

function toContestProblem(row, { hideDetails = false } = {}) {
  if (hideDetails) {
    return {
      problemId: row.problem_id,
      displayOrder: row.display_order,
      points: row.points,
      title: null,
      slug: null,
      difficulty: null,
      hidden: true,
    };
  }
  return {
    problemId: row.problem_id,
    displayOrder: row.display_order,
    points: row.points,
    title: row.title,
    slug: row.slug,
    difficulty: row.difficulty,
    hidden: false,
  };
}

module.exports = {
  PENALTY_MINUTES_PER_WRONG,
  deriveContestStatus,
  toContestSummary,
  toContestProblem,
  toNumber,
};
