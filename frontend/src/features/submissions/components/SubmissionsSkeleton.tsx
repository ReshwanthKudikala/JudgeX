import { Skeleton } from '@/components/common/Skeleton';

export function SubmissionsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
