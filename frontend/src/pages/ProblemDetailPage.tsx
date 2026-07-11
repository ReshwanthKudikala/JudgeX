import { useParams } from 'react-router-dom';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ApiError } from '@/types';
import { ProblemCodeEditor } from '@/features/editor';
import { ProblemBreadcrumb } from '@/features/problems/components/ProblemBreadcrumb';
import { ProblemErrorState } from '@/features/problems/components/ProblemErrorState';
import { ProblemLayout } from '@/features/problems/components/ProblemLayout';
import { ProblemSkeleton } from '@/features/problems/components/ProblemSkeleton';
import { ProblemStatementPanel } from '@/features/problems/components/ProblemStatementPanel';
import { SubmissionsHistoryPanel } from '@/features/submissions/components/SubmissionsHistoryPanel';
import { useProblem } from '@/features/problems/hooks/useProblem';
import { useAuthStore } from '@/store';

export function ProblemDetailPage() {
  const { slug, problemId } = useParams<{ slug?: string; problemId?: string }>();
  const problemSlug = slug ?? problemId;
  const token = useAuthStore((s) => s.token);

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
      statement={
        <Tabs defaultValue="description" className="space-y-4">
          <TabsList className="h-9">
            <TabsTrigger value="description" className="px-3 text-xs">
              Description
            </TabsTrigger>
            <TabsTrigger value="submissions" className="px-3 text-xs">
              Submissions
            </TabsTrigger>
          </TabsList>
          <TabsContent value="description">
            <ProblemStatementPanel problem={problem} />
          </TabsContent>
          <TabsContent value="submissions">
            {token ? (
              <SubmissionsHistoryPanel
                problemId={problem.id}
                embedded
                enabled={Boolean(token)}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                Sign in to view your submissions for this problem.
              </p>
            )}
          </TabsContent>
        </Tabs>
      }
      editor={
        <ProblemCodeEditor
          problemSlug={problem.slug}
          problemId={problem.id}
          className="h-full border-0 lg:rounded-none"
        />
      }
    />
  );
}
