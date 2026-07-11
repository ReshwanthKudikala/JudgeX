import { Skeleton } from '@/components/common/Skeleton';

const ROWS = 8;

export function ProblemsSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border" aria-busy="true" aria-label="Loading problems">
      <div className="grid grid-cols-[56px_1fr_100px_90px] gap-0 border-b border-border bg-[#151820] px-4 py-3 sm:grid-cols-[56px_1fr_110px_100px]">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="hidden h-3 w-20 sm:block" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: ROWS }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[56px_1fr_100px_90px] items-center gap-0 px-4 py-3.5 sm:grid-cols-[56px_1fr_110px_100px]"
          >
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-2/3 max-w-[280px]" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="hidden h-4 w-12 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
