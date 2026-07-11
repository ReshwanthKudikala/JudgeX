import { Navigate, Outlet } from 'react-router-dom';

import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { Spinner } from '@/components/common/Spinner';

/** Auth pages only — signed-in users are sent to the home dashboard. */
export function PublicRoute() {
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" label="Loading…" />
      </div>
    );
  }

  if (token) {
    return <Navigate to={paths.home} replace />;
  }

  return <Outlet />;
}
