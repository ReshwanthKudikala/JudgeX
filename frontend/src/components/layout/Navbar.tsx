import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, PanelLeft, Settings, User } from 'lucide-react';

import { HeaderSearch } from '@/components/layout/HeaderSearch';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

interface NavbarProps {
  onMenuClick?: () => void;
  onToggleCollapse?: () => void;
  sidebarCollapsed?: boolean;
}

function UserAvatar({ username }: { username: string }) {
  const initial = username.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary"
      aria-hidden
    >
      {initial}
    </span>
  );
}

function UserMenu({
  username,
  onLogout,
}: {
  username: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted',
          'transition-colors duration-150 hover:bg-overlay hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${username}`}
        onClick={() => setOpen((v) => !v)}
      >
        <UserAvatar username={username} />
        <span className="hidden max-w-[100px] truncate lg:inline">{username}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-48 animate-slide-up rounded-lg border border-border bg-card py-1 shadow-card"
        >
          <Link
            role="menuitem"
            to={paths.profile}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-overlay hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4" aria-hidden />
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-2 text-sm text-muted/60"
            title="Coming soon"
          >
            <Settings className="h-4 w-4" aria-hidden />
            Settings
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-overlay hover:text-foreground"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Global action bar — no primary nav links (sidebar owns navigation). */
export function Navbar({
  onMenuClick,
  onToggleCollapse,
  sidebarCollapsed = false,
}: NavbarProps) {
  const { user, token, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
        <button
          type="button"
          className="rounded-md p-2 text-muted transition-colors duration-150 hover:bg-overlay hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {onToggleCollapse ? (
          <button
            type="button"
            className="hidden rounded-md p-2 text-muted transition-colors duration-150 hover:bg-overlay hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:inline-flex"
            onClick={onToggleCollapse}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={sidebarCollapsed}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        ) : null}

        <Link
          to={paths.home}
          className="flex shrink-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-on-primary">
            JX
          </span>
          <span className="hidden text-base font-semibold tracking-tight text-foreground sm:inline">
            Judge<span className="text-primary">X</span>
          </span>
        </Link>

        <div className="mx-2 min-w-0 flex-1 md:mx-4 md:flex md:justify-center">
          <HeaderSearch className="w-full max-w-[12rem] sm:max-w-xs md:max-w-md" />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            disabled
            className="hidden rounded-md p-2 text-muted/50 sm:inline-flex"
            aria-label="Notifications (coming soon)"
            title="Notifications — coming soon"
          >
            <Bell className="h-4 w-4" aria-hidden />
          </button>

          <ThemeToggle />

          {token && user ? (
            <UserMenu username={user.username} onLogout={() => logout()} />
          ) : (
            <>
              <Link
                to={paths.login}
                className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted transition-colors duration-150 hover:bg-overlay hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                Login
              </Link>
              <Link to={paths.register} className="hidden sm:inline-flex">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
