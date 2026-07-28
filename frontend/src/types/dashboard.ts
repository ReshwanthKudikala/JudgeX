import type { SubmissionSummary } from '@/types/submissions';
import type { ProblemDifficulty } from '@/types/problems';

export interface DashboardSummary {
  solved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  acceptedSubmissions: number;
  totalSubmissions: number;
  acceptanceRate: number;
  /** Placeholder until streak tracking ships. */
  currentStreak: number | null;
}

export interface DifficultyBreakdownItem {
  difficulty: ProblemDifficulty;
  count: number;
}

export interface VerdictBreakdownItem {
  verdict: 'accepted' | 'failed' | string;
  label?: string;
  count: number;
}

export interface UserDashboard {
  summary: DashboardSummary;
  recentSubmissions: SubmissionSummary[];
  charts: {
    difficultyBreakdown: DifficultyBreakdownItem[];
    verdictBreakdown: VerdictBreakdownItem[];
  };
}
