import { useState } from 'react';
import { Trophy } from 'lucide-react';

import { Pagination } from '@/components/ui/Pagination';
import { ContestCards } from '@/features/contests/components/ContestCards';
import { ContestsEmptyState } from '@/features/contests/components/ContestsEmptyState';
import { ContestsErrorState } from '@/features/contests/components/ContestsErrorState';
import { ContestsSkeleton } from '@/features/contests/components/ContestsSkeleton';
import { useContests } from '@/features/contests/hooks/useContests';
import type { ContestStatus } from '@/types/contests';
import { cn } from '@/utils/cn';

const TABS: Array<{ id: ContestStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'running', label: 'Running' },
  { id: 'ended', label: 'Past' },
];

export function ContestsPage() {
  const [status, setStatus] = useState<ContestStatus | 'all'>('all');
  const {
    contests,
    pagination,
    page,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    onPageChange,
    setPage,
  } = useContests(status);

  const showSkeleton = isLoading && contests.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-muted">
            <Trophy className="h-3.5 w-3.5 text-primary" aria-hidden />
            Practice contests
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Contests</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Browse upcoming, running, and past contests. Open a contest to review
            the problem set and practice on the linked problems.
          </p>
        </div>
      </div>

      <div
        className="relative inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
        role="tablist"
        aria-label="Contest status"
      >
        {TABS.map((tab) => {
          const active = status === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                'relative rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200',
                active
                  ? 'bg-card text-foreground shadow-card'
                  : 'text-muted hover:text-foreground',
              )}
              onClick={() => {
                setStatus(tab.id);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isError ? (
        <ContestsErrorState error={error} onRetry={() => void refetch()} />
      ) : showSkeleton ? (
        <ContestsSkeleton />
      ) : contests.length === 0 ? (
        <ContestsEmptyState filtered={status !== 'all'} />
      ) : (
        <div className="space-y-4">
          <ContestCards
            contests={contests}
            isFetching={isFetching && !isLoading}
          />
          <Pagination
            page={pagination.page || page}
            pageSize={pagination.limit}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
