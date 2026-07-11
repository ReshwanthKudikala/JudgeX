import type { PaginationMeta } from '@/types/problems';

export interface AdminDashboardOverview {
  users: { total: number; active7d: number; active30d: number };
  problems: { total: number; published: number };
  editorials: { total: number; published: number };
  discussions: number;
  contests: number;
  submissions: { total: number; accepted: number; acceptanceRate: number };
  queue: {
    name: string;
    healthy: boolean;
    counts: Record<string, number> | null;
    error?: string;
  };
  worker: {
    healthy: boolean;
    activeJobs: number;
    waitingJobs: number;
    failedJobs: number;
    uptime?: number | null;
    lastSeenAt?: string | null;
  };
}

export interface AdminMonitoringSnapshot {
  ready: boolean;
  degraded: boolean;
  status: string;
  uptime: number;
  version: string | null;
  checks: {
    postgres: { ok: boolean; latencyMs?: number; error?: string };
    redis: { ok: boolean; latencyMs?: number; error?: string };
    bullmq: { ok: boolean; latencyMs?: number; error?: string; counts?: Record<string, number> };
    worker: {
      ok: boolean;
      uptime?: number;
      lastSeenAt?: string;
      ageMs?: number;
      error?: string;
    };
    docker: { ok: boolean; latencyMs?: number; error?: string };
  };
  queue: {
    name: string;
    depth: Record<string, number> | null;
  };
  worker: {
    healthy: boolean;
    uptime: number | null;
    lastSeenAt: string | null;
    ageMs: number | null;
  };
  recentFailures: AdminFailedJob[];
  timestamp: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  isSuspended: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  submissionCount?: number;
}

export interface AdminUserListParams {
  page?: number;
  limit?: number;
  username?: string;
  email?: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'suspended';
}

export interface AdminUserListResult {
  users: AdminUser[];
  pagination: PaginationMeta;
}

export type ModerationEntityType =
  | 'problems'
  | 'editorials'
  | 'discussions'
  | 'comments';

export type ModerationAction = 'publish' | 'unpublish' | 'delete' | 'restore';

export interface ModerationItem {
  id: string;
  entityType: string;
  title: string | null;
  slug: string | null;
  difficulty: string | null;
  published: boolean | null;
  isDeleted: boolean;
  authorUsername: string | null;
  discussionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationListResult {
  items: ModerationItem[];
  pagination: PaginationMeta;
  entityType: ModerationEntityType;
}

export interface AdminQueueStatus {
  name: string;
  counts: Record<string, number>;
}

export interface AdminFailedJob {
  id: string;
  name: string;
  failedReason: string | null;
  attemptsMade: number;
  timestamp: number;
  finishedOn: number | null;
  data: { submissionId: string | null; requestId?: string | null };
}

export interface AdminAnalytics {
  dailySubmissions: Array<{ date: string; submissions: number; accepted: number }>;
  acceptanceRate: number;
  mostSolvedProblems: Array<{
    id: string;
    slug: string;
    title: string;
    difficulty: string;
    solvedCount: number;
  }>;
  mostActiveUsers: Array<{
    id: string;
    username: string;
    submissionCount: number;
    problemsSolved: number;
  }>;
  languageUsage: Array<{ language: string; count: number }>;
  contestParticipation: Array<{
    id: string;
    title: string;
    status: string;
    participants: number;
  }>;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogListResult {
  logs: AuditLogEntry[];
  pagination: PaginationMeta;
}
