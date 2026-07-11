import { Link } from 'react-router-dom';

import { paths } from '@/routes/paths';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {year} JudgeX. Competitive programming platform.</p>
        <div className="flex gap-4">
          <Link to={paths.problems} className="transition-colors hover:text-white">
            Problems
          </Link>
          <Link to={paths.leaderboard} className="transition-colors hover:text-white">
            Leaderboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
