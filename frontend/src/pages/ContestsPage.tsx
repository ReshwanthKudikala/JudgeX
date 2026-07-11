import { useState } from 'react';

import { Pagination } from '@/components/ui/Pagination';
import { ContestsEmptyState } from '@/features/contests/components/ContestsEmptyState';
import { ContestsErrorState } from '@/features/contests/components/ContestsErrorState';
import { ContestsSkeleton } from '@/features/contests/components/ContestsSkeleton';
import { ContestsTable } from '@/features/contests/components/ContestsTable';
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
      <div>
        <h1 className="text-2xl font-semibold text-white">Contests</h1>
        <p className="mt-1 text-sm text-muted">
          Timed competitions with live scoreboards.
        </p>
      </div>

      <div
        className="inline-flex items-center gap-1 rounded-md border border-border bg-[#151820] p-1"
        role="tablist"
        aria-label="Contest status"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={status === tab.id}
            className={cn(
              'rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
              status === tab.id
                ? 'bg-card text-white shadow-card'
                : 'text-muted hover:text-white',
            )}
            onClick={() => {
              setStatus(tab.id);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isError ? (
        <ContestsErrorState error={error} onRetry={() => void refetch()} />
      ) : showSkeleton ? (
        <ContestsSkeleton />
      ) : contests.length === 0 ? (
        <ContestsEmptyState />
      ) : (
        <div className="space-y-4">
          <ContestsTable
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
