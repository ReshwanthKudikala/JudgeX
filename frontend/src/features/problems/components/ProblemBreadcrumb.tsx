import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { paths } from '@/routes/paths';

interface ProblemBreadcrumbProps {
  title: string;
}

export function ProblemBreadcrumb({ title }: ProblemBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <li>
          <Link
            to={paths.problems}
            className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-sm"
          >
            Problems
          </Link>
        </li>
        <li aria-hidden className="text-muted/60">
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li className="truncate font-medium text-muted-foreground" aria-current="page">
          {title}
        </li>
      </ol>
    </nav>
  );
}
