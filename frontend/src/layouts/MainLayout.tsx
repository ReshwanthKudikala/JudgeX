import { useState } from 'react';
import { matchPath, Outlet, useLocation } from 'react-router-dom';

import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';
import { cn } from '@/utils/cn';

/** Problem solve workspace (`/problems/:slug`) — desktop uses a locked viewport. */
function useProblemWorkspace() {
  const { pathname } = useLocation();
  return Boolean(matchPath({ path: '/problems/:slug', end: true }, pathname));
}

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isProblemWorkspace = useProblemWorkspace();

  return (
    <div
      className={cn(
        'flex flex-col bg-background',
        isProblemWorkspace ? 'min-h-screen lg:h-dvh lg:overflow-hidden' : 'min-h-screen',
      )}
    >
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div
        className={cn(
          'mx-auto flex w-full max-w-app flex-1',
          isProblemWorkspace && 'min-h-0',
        )}
      >
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main
          className={cn(
            'min-w-0 flex-1 px-4 sm:px-6',
            isProblemWorkspace
              ? 'flex min-h-0 flex-col py-2 lg:overflow-hidden lg:py-2'
              : 'py-6',
          )}
        >
          <Outlet />
        </main>
      </div>
      {/* Hide footer on desktop solve view so panels can use the full remaining height. */}
      <div className={cn(isProblemWorkspace && 'lg:hidden')}>
        <Footer />
      </div>
    </div>
  );
}
