import { apiClient, unwrapData, unwrapEnvelope } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type {
  AdminAnalytics,
  AdminDashboardOverview,
  AdminFailedJob,
  AdminQueueStatus,
  AdminUser,
  AdminUserListParams,
  AdminUserListResult,
  AuditLogEntry,
  AuditLogListResult,
  ModerationAction,
  ModerationEntityType,
  ModerationItem,
  ModerationListResult,
} from '@/types/admin';
import type { PaginationMeta } from '@/types/problems';

function fallbackPagination(
  params: { page?: number; limit?: number },
  data: unknown[],
): PaginationMeta {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    total: data.length,
    totalPages: 1,
  };
}

export async function getAdminDashboard(): Promise<AdminDashboardOverview> {
  return unwrapData(
    apiClient.get<ApiEnvelope<AdminDashboardOverview>>('/admin/dashboard'),
  );
}

export async function listAdminUsers(
  params: AdminUserListParams = {},
): Promise<AdminUserListResult> {
  const { data, meta } = await unwrapEnvelope(
    apiClient.get<ApiEnvelope<AdminUser[]>>('/admin/users', { params }),
  );
  const users = Array.isArray(data) ? data : [];
  return {
    users,
    pagination: (meta.pagination as PaginationMeta) ?? fallbackPagination(params, users),
  };
}

export async function suspendAdminUser(id: string): Promise<AdminUser> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AdminUser>>(`/admin/users/${id}/suspend`),
  );
}

export async function unsuspendAdminUser(id: string): Promise<AdminUser> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AdminUser>>(`/admin/users/${id}/unsuspend`),
  );
}

export async function promoteAdminUser(id: string): Promise<AdminUser> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AdminUser>>(`/admin/users/${id}/promote`),
  );
}

export async function demoteAdminUser(id: string): Promise<AdminUser> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AdminUser>>(`/admin/users/${id}/demote`),
  );
}

export async function listModeration(params: {
  entityType: ModerationEntityType;
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
}): Promise<ModerationListResult> {
  const { data, meta } = await unwrapEnvelope(
    apiClient.get<ApiEnvelope<ModerationItem[]>>('/admin/moderation', { params }),
  );
  const items = Array.isArray(data) ? data : [];
  return {
    items,
    entityType: (meta.entityType as ModerationEntityType) ?? params.entityType,
    pagination: (meta.pagination as PaginationMeta) ?? fallbackPagination(params, items),
  };
}

export async function bulkModeration(input: {
  entityType: ModerationEntityType;
  action: ModerationAction;
  ids: string[];
}): Promise<{ entityType: string; action: string; requested: number; affected: number }> {
  return unwrapData(
    apiClient.post<
      ApiEnvelope<{ entityType: string; action: string; requested: number; affected: number }>
    >('/admin/moderation/bulk', input),
  );
}

export async function getAdminQueue(): Promise<AdminQueueStatus> {
  return unwrapData(apiClient.get<ApiEnvelope<AdminQueueStatus>>('/admin/queue'));
}

export async function listAdminFailedJobs(params: {
  start?: number;
  end?: number;
} = {}): Promise<{ jobs: AdminFailedJob[] }> {
  return unwrapData(
    apiClient.get<ApiEnvelope<{ jobs: AdminFailedJob[] }>>('/admin/queue/failed', {
      params,
    }),
  );
}

export async function retryAdminFailedJobs(): Promise<{ retried: number }> {
  return unwrapData(
    apiClient.post<ApiEnvelope<{ retried: number }>>('/admin/queue/retry-failed'),
  );
}

export async function clearAdminCompletedJobs(): Promise<{ cleared: boolean }> {
  return unwrapData(
    apiClient.post<ApiEnvelope<{ cleared: boolean }>>('/admin/queue/clear-completed'),
  );
}

export async function getAdminAnalytics(days = 14): Promise<AdminAnalytics> {
  return unwrapData(
    apiClient.get<ApiEnvelope<AdminAnalytics>>('/admin/analytics', {
      params: { days },
    }),
  );
}

export async function listAuditLogs(params: {
  page?: number;
  limit?: number;
  q?: string;
  action?: string;
  entityType?: string;
} = {}): Promise<AuditLogListResult> {
  const { data, meta } = await unwrapEnvelope(
    apiClient.get<ApiEnvelope<AuditLogEntry[]>>('/admin/audit-logs', { params }),
  );
  const logs = Array.isArray(data) ? data : [];
  return {
    logs,
    pagination: (meta.pagination as PaginationMeta) ?? fallbackPagination(params, logs),
  };
}
