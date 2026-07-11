import { useParams } from 'react-router-dom';

import { ApiError } from '@/types';
import { EditorPlaceholder } from '@/features/problems/components/EditorPlaceholder';
import { ProblemBreadcrumb } from '@/features/problems/components/ProblemBreadcrumb';
import { ProblemErrorState } from '@/features/problems/components/ProblemErrorState';
import { ProblemLayout } from '@/features/problems/components/ProblemLayout';
import { ProblemSkeleton } from '@/features/problems/components/ProblemSkeleton';
import { ProblemStatementPanel } from '@/features/problems/components/ProblemStatementPanel';
import { useProblem } from '@/features/problems/hooks/useProblem';

export function ProblemDetailPage() {
  const { slug, problemId } = useParams<{ slug?: string; problemId?: string }>();
  // Support both `:slug` and legacy `:problemId` param names.
  const problemSlug = slug ?? problemId;

  const { data: problem, isLoading, isError, error, refetch } = useProblem(problemSlug);

  if (!problemSlug) {
    return <ProblemErrorState notFound />;
  }

  if (isLoading) {
    return <ProblemSkeleton />;
  }

  if (isError || !problem) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <ProblemErrorState
        notFound={notFound}
        error={error}
        onRetry={notFound ? undefined : () => void refetch()}
        title="Couldn’t load problem"
        fallbackMessage="Something went wrong while loading this problem."
      />
    );
  }

  return (
    <ProblemLayout
      breadcrumb={<ProblemBreadcrumb title={problem.title} />}
      statement={<ProblemStatementPanel problem={problem} />}
      editor={<EditorPlaceholder className="h-full border-0 lg:rounded-none" />}
    />
  );
}
