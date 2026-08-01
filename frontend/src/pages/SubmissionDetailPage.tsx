import { lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/features/editorials';
import { SubmissionsErrorState } from '@/features/submissions/components/SubmissionsErrorState';
import { VerdictBadge } from '@/features/submissions/components/VerdictBadge';
import { VerdictPanel } from '@/features/submissions/components/VerdictPanel';
import { useSubmissionDetail } from '@/features/submissions/hooks/useSubmissionDetail';
import { paths } from '@/routes/paths';
import { ApiError } from '@/types';
import {
  LANGUAGE_LABELS,
  type SubmissionLanguage,
} from '@/types/submissions';

const MonacoEditor = lazy(() =>
  import('@/features/editor/components/MonacoEditor').then((m) => ({
    default: m.MonacoEditor,
  })),
);

export function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const {
    submission,
    isLoading,
    isError,
    error,
    refetch,
    coachAnswer,
    coachLoading,
    coachError,
    requestCompileExplanation,
  } = useSubmissionDetail(submissionId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !submission) {
    const forbidden = error instanceof ApiError && error.status === 403;
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <SubmissionsErrorState
        error={
          forbidden
            ? new ApiError(403, 'FORBIDDEN', 'You do not have access to this submission.')
            : notFound
              ? new ApiError(404, 'NOT_FOUND', 'Submission not found.')
              : error
        }
        onRetry={forbidden || notFound ? undefined : () => void refetch()}
      />
    );
  }

  const language = submission.language as SubmissionLanguage;
  const runtime = submission.runtime ?? submission.runtimeMs ?? null;
  const problemTitle =
    submission.problem?.title ?? submission.problemTitle ?? 'Submission detail';
  const problemSlug = submission.problem?.slug ?? submission.problemSlug;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link to={paths.submissions} className="hover:text-foreground">
          My Submissions
        </Link>
        <span aria-hidden>/</span>
        <span className="text-muted-foreground">Detail</span>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted">Problem</p>
            <h1 className="truncate text-2xl font-semibold text-foreground">
              {problemSlug ? (
                <Link
                  to={paths.problemDetail(problemSlug)}
                  className="hover:text-primary"
                >
                  {problemTitle}
                </Link>
              ) : (
                problemTitle
              )}
            </h1>
          </div>
          <VerdictBadge verdict={submission.verdict} status={submission.status} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Meta
            label="Language"
            value={LANGUAGE_LABELS[language] ?? language}
          />
          <Meta
            label="Runtime"
            value={runtime != null ? `${runtime} ms` : '—'}
          />
          <Meta
            label="Submitted"
            value={
              submission.submittedAt
                ? new Date(submission.submittedAt).toLocaleString()
                : '—'
            }
          />
        </dl>
      </section>

      <VerdictPanel submission={submission} />

      {submission.verdict === 'compile_error' ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            AI Coach
          </p>
          {!coachAnswer && !coachLoading ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => requestCompileExplanation()}
            >
              Explain Compile Error
            </Button>
          ) : null}
          {coachLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Explaining the compile error…
            </div>
          ) : null}
          {coachError && !coachLoading ? (
            <p className="text-sm text-muted">
              {coachError instanceof ApiError
                ? coachError.message
                : 'AI Coach is unavailable right now. Please try again.'}
            </p>
          ) : null}
          {coachAnswer ? (
            <MarkdownRenderer
              markdown={coachAnswer}
              className="text-sm text-foreground"
            />
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-surface px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
          Source code
        </div>
        <div className="h-[360px] sm:h-[420px]">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted">
                Loading editor…
              </div>
            }
          >
            <MonacoEditor
              language={language === 'cpp' ? 'cpp' : 'python'}
              value={submission.sourceCode ?? ''}
              readOnly
              className="h-full"
            />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}
