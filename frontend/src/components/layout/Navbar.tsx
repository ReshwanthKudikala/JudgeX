import { NavLink, Link } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

interface NavbarProps {
  onMenuClick?: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-3 py-2 text-sm font-medium transition-colors rounded-md',
    isActive ? 'text-white bg-white/5' : 'text-muted hover:text-white hover:bg-white/5',
  );

function UserAvatar({ username }: { username: string }) {
  const initial = username.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-[#1a1a1a]"
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user, token, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="rounded-md p-2 text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to={paths.home} className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-[#1a1a1a]">
            JX
          </span>
          <span className="text-base font-semibold tracking-tight text-white">
            Judge<span className="text-primary">X</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Primary">
          <NavLink to={paths.problems} className={navLinkClass}>
            Problems
          </NavLink>
          <NavLink to={paths.contests} className={navLinkClass}>
            Contests
          </NavLink>
          {token ? (
            <NavLink to={paths.submissions} className={navLinkClass}>
              Submissions
            </NavLink>
          ) : null}
          <NavLink to={paths.leaderboard} className={navLinkClass}>
            Leaderboard
          </NavLink>
          {token && user?.role === 'admin' ? (
            <NavLink to={paths.admin} className={navLinkClass}>
              Admin
            </NavLink>
          ) : null}
          {token ? (
            <NavLink to={paths.profile} className={navLinkClass}>
              Profile
            </NavLink>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {token && user ? (
            <>
              <Link
                to={paths.profile}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                aria-label={`Profile for ${user.username}`}
              >
                <UserAvatar username={user.username} />
                <span className="hidden max-w-[120px] truncate sm:inline">{user.username}</span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <>
              <Link
                to={paths.login}
                className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                Login
              </Link>
              <Link to={paths.register}>
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
