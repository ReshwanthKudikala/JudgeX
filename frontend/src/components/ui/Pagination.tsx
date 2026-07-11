import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages: totalPagesProp,
  onPageChange,
  className,
}: PaginationProps) {
  const totalPages =
    totalPagesProp ?? Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  const canPrev = page > 1;
  const canNext = page < totalPages && total > 0;

  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
      role="navigation"
      aria-label="Pagination"
    >
      <p className="text-xs text-muted">
        Page <span className="text-muted-foreground">{page}</span> of{' '}
        <span className="text-muted-foreground">{Math.max(totalPages, 1)}</span>
        {total > 0 ? (
          <>
            {' '}
            · <span className="text-muted-foreground">{total}</span> total
          </>
        ) : null}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
