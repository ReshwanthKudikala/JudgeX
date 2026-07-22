import { useParams } from 'react-router-dom';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ApiError } from '@/types';
import { DiscussionsPanel } from '@/features/discussions';
import { EditorialPanel, useEditorial } from '@/features/editorials';
import { ProblemCodeEditor } from '@/features/editor';
import { ProblemBreadcrumb } from '@/features/problems/components/ProblemBreadcrumb';
import { ProblemErrorState } from '@/features/problems/components/ProblemErrorState';
import { ProblemHeader } from '@/features/problems/components/ProblemHeader';
import { ProblemLayout } from '@/features/problems/components/ProblemLayout';
import { ProblemSkeleton } from '@/features/problems/components/ProblemSkeleton';
import { ProblemStatementPanel } from '@/features/problems/components/ProblemStatementPanel';
import { SubmissionsHistoryPanel } from '@/features/submissions/components/SubmissionsHistoryPanel';
import { useProblem } from '@/features/problems/hooks/useProblem';
import { useAuthStore } from '@/store';

const tabTriggerClass =
  'rounded-none border-b-2 bg-transparent px-3 py-2 text-xs shadow-none hover:bg-transparent';

export function ProblemDetailPage() {
  const { slug, problemId } = useParams<{ slug?: string; problemId?: string }>();
  const problemSlug = slug ?? problemId;
  const token = useAuthStore((s) => s.token);
  // Remount editor when auth identity changes so in-memory code / run / submit reset.
  const workspaceOwnerKey = useAuthStore((s) => s.user?.id ?? 'anon');

  const { data: problem, isLoading, isError, error, refetch } = useProblem(problemSlug);
  const { data: editorial } = useEditorial(problem?.slug);

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
    <div className="flex min-h-0 flex-1 flex-col">
      <ProblemLayout
        breadcrumb={<ProblemBreadcrumb title={problem.title} />}
        statement={
          <Tabs defaultValue="description" className="min-h-0">
            <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
              <ProblemHeader problem={problem} />
              <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-0 bg-transparent p-0 px-3 sm:px-4">
                <TabsTrigger value="description" className={tabTriggerClass}>
                  Description
                </TabsTrigger>
                <TabsTrigger value="editorial" className={tabTriggerClass}>
                  Editorial
                </TabsTrigger>
                <TabsTrigger value="submissions" className={tabTriggerClass}>
                  Submissions
                </TabsTrigger>
                <TabsTrigger value="solutions" className={tabTriggerClass}>
                  Solutions
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="px-3 py-4 sm:px-4">
              <TabsContent value="description" className="mt-0">
                <ProblemStatementPanel problem={problem} />
              </TabsContent>
              <TabsContent value="editorial" className="mt-0">
                {editorial ? (
                  <EditorialPanel editorial={editorial} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted">
                    Editorial for this problem is coming soon.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="submissions" className="mt-0">
                {token ? (
                  <SubmissionsHistoryPanel
                    problemId={problem.id}
                    embedded
                    enabled={Boolean(token)}
                  />
                ) : (
                  <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                    Sign in to view your submissions for this problem.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="solutions" className="mt-0">
                <DiscussionsPanel problemSlug={problem.slug} />
              </TabsContent>
            </div>
          </Tabs>
        }
        editor={
          <ProblemCodeEditor
            key={workspaceOwnerKey}
            problemSlug={problem.slug}
            problemId={problem.id}
            timeLimitMs={problem.timeLimitMs ?? null}
            className="h-full border-0 shadow-none"
          />
        }
      />
    </div>
  );
}
