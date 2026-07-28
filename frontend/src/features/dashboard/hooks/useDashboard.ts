import { useQuery } from '@tanstack/react-query';

import { getDashboard } from '@/api/dashboard.api';
import { useAuthStore } from '@/store';

export const dashboardQueryKey = ['dashboard'] as const;

export function useDashboard() {
  const token = useAuthStore((s) => s.token);

  return useQuery({
    queryKey: dashboardQueryKey,
    queryFn: getDashboard,
    enabled: Boolean(token),
    staleTime: 15_000,
  });
}
