import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  Shield,
  Users,
  BarChart3,
} from 'lucide-react';

import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

const links = [
  { to: paths.admin, label: 'Overview', icon: LayoutDashboard, end: true },
  { to: paths.adminUsers, label: 'Users', icon: Users },
  { to: paths.adminModeration, label: 'Moderation', icon: Shield },
  { to: paths.adminAnalytics, label: 'Analytics', icon: BarChart3 },
  { to: paths.adminQueue, label: 'Queue', icon: Activity },
  { to: paths.adminAuditLogs, label: 'Audit logs', icon: ClipboardList },
] as const;

export function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Admin</h1>
        <p className="text-sm text-muted">Platform management and monitoring</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={'end' in link ? link.end : false}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium',
                  isActive
                    ? 'bg-primary-muted text-primary'
                    : 'text-muted hover:bg-white/5 hover:text-foreground',
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
