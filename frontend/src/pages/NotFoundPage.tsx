import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { paths } from '@/routes/paths';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-primary">404</p>
      <h1 className="text-3xl font-semibold text-white">Page not found</h1>
      <p className="max-w-md text-sm text-muted">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to={paths.home}>
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}
