import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { paths } from '@/routes/paths';

interface ProblemBreadcrumbProps {
  title: string;
}

export function ProblemBreadcrumb({ title }: ProblemBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1.5 shrink-0 lg:mb-1.5">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        <li>
          <Link
            to={paths.problems}
            className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Problems
          </Link>
        </li>
        <li aria-hidden className="text-muted/60">
          <ChevronRight className="h-3 w-3" />
        </li>
        <li className="truncate font-medium text-muted-foreground" aria-current="page">
          {title}
        </li>
      </ol>
    </nav>
  );
}
