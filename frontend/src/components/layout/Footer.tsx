import { Link } from 'react-router-dom';

import { paths } from '@/routes/paths';

function readBuildMeta() {
  const version = import.meta.env.VITE_APP_VERSION || '0.1.0';
  const gitSha = import.meta.env.VITE_GIT_SHA || '';
  const shortSha = gitSha && gitSha !== 'unknown' ? gitSha.slice(0, 7) : null;
  return { version, shortSha };
}

export function Footer() {
  const year = new Date().getFullYear();
  const { version, shortSha } = readBuildMeta();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-app flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {year} JudgeX. Competitive programming platform.
          <span className="ml-2 text-muted/80">
            v{version}
            {shortSha ? ` · ${shortSha}` : ''}
          </span>
        </p>
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
