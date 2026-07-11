import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { Spinner } from '@/components/common/Spinner';

/** Requires a persisted JWT. Guests are redirected to login. */
export function ProtectedRoute() {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" label="Loading session…" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to={paths.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
