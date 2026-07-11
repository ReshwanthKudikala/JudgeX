export type LeaderboardTimeframe = 'all' | 'monthly' | 'weekly';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string | null;
  solved: number;
  /** Legacy alias of solved (backwards compatible). */
  problemsSolved?: number;
  accepted: number;
  submissions: number;
  acceptanceRate: number;
  score: number;
  lastSolvedAt?: string | null;
}

export interface LeaderboardListParams {
  page?: number;
  limit?: number;
  timeframe?: LeaderboardTimeframe;
}

export interface LeaderboardListResult {
  entries: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timeframe: LeaderboardTimeframe;
}

export const TIMEFRAME_LABELS: Record<LeaderboardTimeframe, string> = {
  all: 'All time',
  monthly: 'This month',
  weekly: 'This week',
};
