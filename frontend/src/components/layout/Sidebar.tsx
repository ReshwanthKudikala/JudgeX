import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  History,
  Trophy,
  User,
  X,
} from 'lucide-react';

import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { cn } from '@/utils/cn';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const links = [
  { to: paths.home, label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: paths.problems, label: 'Problems', icon: BookOpen },
  { to: paths.submissions, label: 'Submissions', icon: History, auth: true },
  { to: paths.leaderboard, label: 'Leaderboard', icon: Trophy },
  { to: paths.profile, label: 'Profile', icon: User, auth: true },
] as const;

export function Sidebar({ open, onClose }: SidebarProps) {
  const token = useAuthStore((s) => s.token);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
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
          <span className="text-sm font-semibold text-white">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {links.map((link) => {
            if ('auth' in link && link.auth && !token) return null;
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={'end' in link ? link.end : false}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-muted text-primary'
                      : 'text-muted hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-border p-4 text-xs text-muted">
          JudgeX · Dark theme
        </div>
      </aside>
    </>
  );
}
