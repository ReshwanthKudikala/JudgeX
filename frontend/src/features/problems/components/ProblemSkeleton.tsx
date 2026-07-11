import { Skeleton, SkeletonText } from '@/components/common/Skeleton';

/** Skeleton that mirrors the final split statement | editor layout. */
export function ProblemSkeleton() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Loading problem">
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border">
        <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5 lg:rounded-none lg:border-0 lg:border-r">
          <Skeleton className="h-7 w-3/4 max-w-md" />
          <div className="flex gap-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="border-t border-border pt-4">
            <SkeletonText lines={8} />
          </div>
          <Skeleton className="mt-4 h-24 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>

        <div className="flex min-h-[420px] flex-col rounded-lg border border-border bg-card lg:rounded-none lg:border-0">
          <div className="flex items-center gap-3 border-b border-border px-3 py-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-1 items-center justify-center bg-[#0c0e12]">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-3 py-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="border-t border-border px-3 py-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-3 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
