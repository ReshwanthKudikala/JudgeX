export type ContestStatus = 'upcoming' | 'running' | 'ended';
export type ContestVisibility = 'public' | 'private';

export interface ContestProblem {
  problemId: string;
  displayOrder: number;
  points: number;
  title: string | null;
  slug: string | null;
  difficulty?: string | null;
  hidden?: boolean;
}

export interface ContestSummary {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  visibility: ContestVisibility;
  status: ContestStatus;
  participantCount: number;
  problemCount?: number;
  joined?: boolean;
  createdAt?: string;
  updatedAt?: string;
  problems?: ContestProblem[];
}

export interface ContestListParams {
  page?: number;
  limit?: number;
  status?: ContestStatus;
}

export interface ContestListResult {
  contests: ContestSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ContestProblemsResult {
  contestId: string;
  status: ContestStatus;
  problems: ContestProblem[];
  hidden: boolean;
}

export interface ContestJoinResult {
  contestId: string;
  userId: string;
  joinedAt: string;
  alreadyJoined?: boolean;
}

export interface ScoreboardEntry {
  rank: number;
  userId: string;
  username: string;
  solved: number;
  penalty: number;
  finishTime?: string | null;
}

export interface ScoreboardResult {
  entries: ScoreboardEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  contestId: string;
  status: ContestStatus;
  participantCount: number;
}

export const CONTEST_STATUS_LABELS: Record<ContestStatus, string> = {
  upcoming: 'Upcoming',
  running: 'Running',
  ended: 'Ended',
};
