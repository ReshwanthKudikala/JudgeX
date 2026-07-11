import { lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/Button';
import { AiExplanation } from '@/features/submissions/components/AiExplanation';
import { CompileOutput } from '@/features/submissions/components/CompileOutput';
import { SubmissionDetails } from '@/features/submissions/components/SubmissionDetails';
import { SubmissionsErrorState } from '@/features/submissions/components/SubmissionsErrorState';
import { VerdictBadge } from '@/features/submissions/components/VerdictBadge';
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

function MonoBlock({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-md border border-border bg-[#0c0e12] p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

export function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const {
    submission,
    isLoading,
    isError,
    error,
    refetch,
    aiExplanation,
    aiLoading,
    aiAvailable,
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Submission</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            {submission.problem ? (
              <Link
                to={paths.problemDetail(submission.problem.slug)}
                className="hover:text-primary"
              >
                {submission.problem.title}
              </Link>
            ) : (
              'Submission detail'
            )}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {LANGUAGE_LABELS[language] ?? language}
            {submission.submittedAt
              ? ` · ${new Date(submission.submittedAt).toLocaleString()}`
              : null}
          </p>
        </div>
        <VerdictBadge verdict={submission.verdict} status={submission.status} />
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <SubmissionDetails submission={submission} />
      </section>

      <section className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-[#151820] px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
          Source code
        </div>
        <div className="h-[360px]">
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

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <MonoBlock label="Stdout" value={submission.stdout} />
        <MonoBlock label="Stderr" value={submission.stderr} />
        {submission.compileOutput ? (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
              Compile output
            </p>
            <CompileOutput output={submission.compileOutput} />
          </div>
        ) : null}
        {submission.verdict === 'compile_error' ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              AI explanation
            </p>
            {!aiAvailable && !aiLoading ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => requestCompileExplanation()}
              >
                Explain compile error
              </Button>
            ) : (
              <AiExplanation
                explanation={aiExplanation}
                loading={aiLoading}
                unavailable={!aiAvailable && !aiLoading}
              />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
