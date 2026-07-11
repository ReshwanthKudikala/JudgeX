import { Suspense, type ReactNode } from 'react';

export function RouteFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center text-sm text-muted"
      role="status"
      aria-live="polite"
    >
      Loading…
    </div>
  );
}

export function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}
