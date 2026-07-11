import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Spinner } from '@/components/common/Spinner';
import { useAuthHydration } from '@/hooks/useAuthHydration';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';

/** Requires a validated JWT. Guests are redirected to login (with return path). */
export function ProtectedRoute() {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthHydration();
  const isValidatingSession = useAuthStore((s) => s.isValidatingSession);

  if (!isHydrated || isValidatingSession) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status">
        <Spinner size="lg" label="Checking session…" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to={paths.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
