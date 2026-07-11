import { NavLink, Link } from 'react-router-dom';
import { Menu, LogOut, User as UserIcon } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { cn } from '@/utils/cn';

interface NavbarProps {
  onMenuClick?: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-3 py-2 text-sm font-medium transition-colors rounded-md',
    isActive ? 'text-white bg-white/5' : 'text-muted hover:text-white hover:bg-white/5',
  );

export function Navbar({ onMenuClick }: NavbarProps) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="rounded-md p-2 text-muted transition-colors hover:bg-white/5 hover:text-white lg:hidden"
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

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <NavLink to={paths.problems} className={navLinkClass}>
            Problems
          </NavLink>
          <NavLink to={paths.leaderboard} className={navLinkClass}>
            Leaderboard
          </NavLink>
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
                className="hidden items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-white sm:flex"
              >
                <UserIcon className="h-4 w-4 text-primary" />
                <span className="max-w-[120px] truncate">{user.username}</span>
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
                className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
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
