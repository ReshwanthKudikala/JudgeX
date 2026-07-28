// Authenticated user dashboard aggregates (Sprint 38).
// Business logic only — live reads from submissions; no judge coupling.

const { dashboardRepository } = require('./dashboard.repository');
const { toSubmissionSummary } = require('../submissions/submissions.service');

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function acceptanceRateOneDecimal(accepted, total) {
  if (total <= 0) return 0;
  return Math.round((accepted / total) * 1000) / 10;
}

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

class DashboardService {
  constructor({ dashboardRepository: repo } = {}) {
    this.dashboardRepository = repo || dashboardRepository;
  }

  /**
   * @param {string} userId
   */
  async getDashboard(userId) {
    const [summaryRow, difficultyRows, verdictRow, recentRows] = await Promise.all([
      this.dashboardRepository.getSummary(userId),
      this.dashboardRepository.getDifficultyBreakdown(userId),
      this.dashboardRepository.getVerdictBreakdown(userId),
      this.dashboardRepository.getRecentSubmissions(userId, { limit: 10 }),
    ]);

    const totalSubmissions = toNumber(summaryRow?.total_submissions);
    const acceptedSubmissions = toNumber(summaryRow?.accepted_submissions);
    const easySolved = toNumber(summaryRow?.easy_solved);
    const mediumSolved = toNumber(summaryRow?.medium_solved);
    const hardSolved = toNumber(summaryRow?.hard_solved);

    const difficultyMap = Object.fromEntries(
      (difficultyRows || []).map((row) => [row.difficulty, toNumber(row.count)]),
    );
    const difficultyBreakdown = DIFFICULTY_ORDER.map((difficulty) => ({
      difficulty,
      count: difficultyMap[difficulty] ?? 0,
    }));

    const accepted = toNumber(verdictRow?.accepted);
    const failed = toNumber(verdictRow?.failed);

    return {
      summary: {
        solved: toNumber(summaryRow?.solved),
        easySolved,
        mediumSolved,
        hardSolved,
        acceptedSubmissions,
        totalSubmissions,
        acceptanceRate: acceptanceRateOneDecimal(acceptedSubmissions, totalSubmissions),
        currentStreak: null,
      },
      recentSubmissions: (recentRows || []).map(toSubmissionSummary),
      charts: {
        difficultyBreakdown,
        verdictBreakdown: [
          { verdict: 'accepted', label: 'Accepted', count: accepted },
          { verdict: 'failed', label: 'Failed', count: failed },
        ],
      },
    };
  }
}

module.exports = {
  DashboardService,
  dashboardService: new DashboardService(),
};
