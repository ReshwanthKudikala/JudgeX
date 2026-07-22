import { Skeleton, SkeletonText } from '@/components/common/Skeleton';

/** Skeleton that mirrors the final split statement | editor layout. */
export function ProblemSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col animate-fade-in lg:overflow-hidden"
      aria-busy="true"
      aria-label="Loading problem"
    >
      <div className="mb-1.5 flex shrink-0 items-center gap-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-32" />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,43fr)_minmax(0,57fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-0 lg:overflow-hidden lg:rounded-md lg:border lg:border-border lg:bg-card">
        <div className="min-h-0 rounded-md border border-border bg-card lg:rounded-none lg:border-0 lg:border-r lg:border-border lg:overflow-hidden">
          <div className="space-y-2 border-b border-border px-3 py-3 sm:px-4">
            <Skeleton className="h-6 w-3/4 max-w-sm" />
            <div className="flex gap-3">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-7 w-20" />
            </div>
          </div>
          <div className="space-y-4 px-3 py-4 sm:px-4">
            <SkeletonText lines={6} />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </div>

        <div className="flex min-h-[420px] flex-col rounded-md border border-border bg-card lg:min-h-0 lg:rounded-none lg:border-0 lg:overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex flex-1 items-center justify-center bg-[#0c0e12]">
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-3 py-1.5">
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-16" />
          </div>
          <div className="border-t border-border px-3 py-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
