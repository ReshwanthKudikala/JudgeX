import { Outlet } from 'react-router-dom';

import {
  useSessionBootstrap,
  useUnauthorizedHandler,
} from '@/features/auth/hooks/useAuth';

/**
 * Root outlet wrapper: restores/validates the session and handles 401 redirects.
 * Does not change the route tree — it only mounts auth side-effects.
 */
export function AuthGateway() {
  useSessionBootstrap();
  useUnauthorizedHandler();
  return <Outlet />;
}
