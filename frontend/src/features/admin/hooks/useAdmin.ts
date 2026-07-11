import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  bulkModeration,
  clearAdminCompletedJobs,
  demoteAdminUser,
  getAdminAnalytics,
  getAdminDashboard,
  getAdminMonitoring,
  getAdminQueue,
  listAdminFailedJobs,
  listAdminUsers,
  listAuditLogs,
  listModeration,
  promoteAdminUser,
  retryAdminFailedJobs,
  suspendAdminUser,
  unsuspendAdminUser,
} from '@/api/admin.api';
import type {
  AdminUserListParams,
  ModerationAction,
  ModerationEntityType,
} from '@/types/admin';

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getAdminDashboard,
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
}

export function useAdminMonitoring() {
  return useQuery({
    queryKey: ['admin', 'monitoring'],
    queryFn: getAdminMonitoring,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useAdminUsers(params: AdminUserListParams) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => listAdminUsers(params),
    staleTime: 15_000,
  });
}

export function useAdminUserActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
  };

  return {
    suspend: useMutation({ mutationFn: suspendAdminUser, onSuccess: invalidate }),
    unsuspend: useMutation({ mutationFn: unsuspendAdminUser, onSuccess: invalidate }),
    promote: useMutation({ mutationFn: promoteAdminUser, onSuccess: invalidate }),
    demote: useMutation({ mutationFn: demoteAdminUser, onSuccess: invalidate }),
  };
}

export function useAdminModeration(params: {
  entityType: ModerationEntityType;
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'moderation', params],
    queryFn: () => listModeration(params),
    staleTime: 15_000,
  });
}

export function useAdminBulkModeration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entityType: ModerationEntityType;
      action: ModerationAction;
      ids: string[];
    }) => bulkModeration(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'moderation'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
    },
  });
}

export function useAdminQueue() {
  return useQuery({
    queryKey: ['admin', 'queue'],
    queryFn: getAdminQueue,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useAdminFailedJobs() {
  return useQuery({
    queryKey: ['admin', 'queue', 'failed'],
    queryFn: () => listAdminFailedJobs({ start: 0, end: 49 }),
    staleTime: 10_000,
  });
}

export function useAdminQueueActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'queue'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
  };
  return {
    retryFailed: useMutation({ mutationFn: retryAdminFailedJobs, onSuccess: invalidate }),
    clearCompleted: useMutation({
      mutationFn: clearAdminCompletedJobs,
      onSuccess: invalidate,
    }),
  };
}

export function useAdminAnalytics(days = 14) {
  return useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => getAdminAnalytics(days),
    staleTime: 60_000,
  });
}

export function useAdminAuditLogs(params: {
  page?: number;
  limit?: number;
  q?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', params],
    queryFn: () => listAuditLogs(params),
    staleTime: 15_000,
  });
}
