import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { UserDashboard } from '@/types/dashboard';

/** GET /dashboard — authenticated user dashboard. */
export async function getDashboard(): Promise<UserDashboard> {
  return unwrapData(
    apiClient.get<ApiEnvelope<UserDashboard>>('/dashboard'),
  );
}
