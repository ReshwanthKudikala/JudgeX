import { Skeleton } from '@/components/common/Skeleton';

export function ContestsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading contests"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-card"
        >
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}
