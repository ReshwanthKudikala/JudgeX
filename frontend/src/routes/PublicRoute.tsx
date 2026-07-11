import { Navigate, Outlet } from 'react-router-dom';

import { Spinner } from '@/components/common/Spinner';
import { useAuthHydration } from '@/hooks/useAuthHydration';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';

/** Auth pages only — signed-in users are sent to the dashboard. */
export function PublicRoute() {
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthHydration();
  const isValidatingSession = useAuthStore((s) => s.isValidatingSession);

  if (!isHydrated || isValidatingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <Spinner size="lg" label="Loading…" />
      </div>
    );
  }

  if (token) {
    return <Navigate to={paths.home} replace />;
  }

  return <Outlet />;
}
