import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Home,
  BookOpen,
  Flag,
  History,
  Trophy,
  User,
  Shield,
  X,
} from 'lucide-react';

import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { cn } from '@/utils/cn';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const links = [
  { to: paths.home, label: 'Home', icon: Home, end: true },
  { to: paths.dashboard, label: 'Dashboard', icon: LayoutDashboard, auth: true },
  { to: paths.problems, label: 'Problems', icon: BookOpen },
  { to: paths.contests, label: 'Contests', icon: Flag },
  { to: paths.submissions, label: 'My Submissions', icon: History, auth: true },
  { to: paths.leaderboard, label: 'Leaderboard', icon: Trophy },
  { to: paths.admin, label: 'Admin', icon: Shield, admin: true },
  { to: paths.profile, label: 'Profile', icon: User, auth: true },
] as const;

export function Sidebar({ open, onClose }: SidebarProps) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:static lg:z-0 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4 lg:hidden">
          <span className="text-sm font-semibold text-foreground">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted transition-colors duration-150 hover:bg-overlay hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Sidebar">
          {links.map((link) => {
            if ('auth' in link && link.auth && !token) return null;
            if ('admin' in link && link.admin && user?.role !== 'admin') return null;
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={'end' in link ? link.end : false}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-primary-muted text-primary'
                      : 'text-muted hover:bg-overlay hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <span className="text-xs text-muted">Appearance</span>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
