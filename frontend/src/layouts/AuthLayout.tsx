import { Link, Outlet } from 'react-router-dom';

import { paths } from '@/routes/paths';

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,161,22,0.18), transparent)',
        }}
      />

      <header className="relative z-10">
        <div className="mx-auto flex h-14 w-full max-w-app items-center px-4 sm:px-6">
          <Link to={paths.home} className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-[#1a1a1a]">
              JX
            </span>
            <span className="text-base font-semibold text-white">
              Judge<span className="text-primary">X</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-slide-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
