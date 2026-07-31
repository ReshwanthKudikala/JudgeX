import { useState } from 'react';
import { matchPath, Outlet, useLocation } from 'react-router-dom';

import { Navbar } from '@/components/layout/Navbar';
import {
  Sidebar,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';
import { cn } from '@/utils/cn';

/** Problem solve workspace (`/problems/:slug`) — desktop uses a locked viewport. */
function useProblemWorkspace() {
  const { pathname } = useLocation();
  return Boolean(matchPath({ path: '/problems/:slug', end: true }, pathname));
}

export function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const isProblemWorkspace = useProblemWorkspace();

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      writeSidebarCollapsed(next);
      return next;
    });
  };

  return (
    <div
      className={cn(
        'flex bg-background',
        isProblemWorkspace ? 'min-h-screen lg:h-dvh lg:overflow-hidden' : 'min-h-screen',
      )}
    >
      <Sidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          isProblemWorkspace && 'min-h-0',
        )}
      >
        <Navbar
          onMenuClick={() => setMobileOpen(true)}
          onToggleCollapse={toggleCollapsed}
          sidebarCollapsed={collapsed}
        />

        <main
          className={cn(
            'mx-auto w-full min-w-0 max-w-app flex-1 px-4 sm:px-6 lg:px-8',
            isProblemWorkspace
              ? 'flex min-h-0 flex-col py-3 lg:overflow-hidden'
              : 'py-8',
          )}
        >
          <Outlet />
        </main>

        <div className={cn(isProblemWorkspace && 'lg:hidden')}>
          <Footer />
        </div>
      </div>
    </div>
  );
}
