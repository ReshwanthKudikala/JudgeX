import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Flag,
  History,
  Trophy,
  User,
  Shield,
  X,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { cn } from '@/utils/cn';

const STORAGE_KEY = 'judgex.sidebar.collapsed';

export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}

interface SidebarProps {
  /** Mobile drawer open */
  open: boolean;
  onClose: () => void;
  /** Desktop icon-only mode */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const links = [
  { to: paths.dashboard, label: 'Dashboard', icon: LayoutDashboard, auth: true },
  { to: paths.problems, label: 'Problems', icon: BookOpen },
  { to: paths.contests, label: 'Contests', icon: Flag },
  { to: paths.submissions, label: 'My Submissions', icon: History, auth: true },
  { to: paths.leaderboard, label: 'Leaderboard', icon: Trophy },
  { to: paths.admin, label: 'Admin', icon: Shield, admin: true },
  { to: paths.profile, label: 'Profile', icon: User, auth: true },
] as const;

/** Primary app navigation. */
export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card',
          'transition-[width,transform] duration-200 ease-out',
          'md:static md:z-0 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'md:w-16' : 'md:w-60',
          'w-64',
        )}
        aria-label="Primary"
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-3 md:hidden">
          <span className="text-sm font-semibold text-foreground">Navigation</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition-colors duration-150 hover:bg-overlay hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cn(
            'hidden h-14 items-center border-b border-border md:flex',
            collapsed ? 'justify-center px-2' : 'justify-between px-3',
          )}
        >
          {!collapsed ? (
            <span className="truncate text-xs font-medium uppercase tracking-wide text-muted">
              Navigate
            </span>
          ) : null}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-md p-1.5 text-muted transition-colors duration-150 hover:bg-overlay hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
          aria-label="Main"
        >
          {links.map((link) => {
            if ('auth' in link && link.auth && !token) return null;
            if ('admin' in link && link.admin && user?.role !== 'admin') return null;
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === paths.dashboard}
                onClick={onClose}
                title={collapsed ? link.label : undefined}
                aria-label={link.label}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    collapsed && 'md:justify-center md:px-0',
                    isActive
                      ? 'bg-primary-muted text-primary'
                      : 'text-muted hover:bg-overlay hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span
                  className={cn(
                    'truncate transition-opacity duration-200',
                    collapsed && 'md:sr-only',
                  )}
                >
                  {link.label}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
