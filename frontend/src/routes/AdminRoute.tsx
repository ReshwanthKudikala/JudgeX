import { Navigate, Outlet } from 'react-router-dom';

import { Spinner } from '@/components/common/Spinner';
import { useAuthHydration } from '@/hooks/useAuthHydration';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';

/** Requires authenticated admin role. */
export function AdminRoute() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthHydration();
  const isValidatingSession = useAuthStore((s) => s.isValidatingSession);

  if (!isHydrated || isValidatingSession) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status">
        <Spinner size="lg" label="Checking admin session…" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to={paths.login} replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to={paths.home} replace />;
  }

  return <Outlet />;
}
