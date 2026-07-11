import { Link } from 'react-router-dom';

import { VerdictBadge } from '@/features/submissions/components/VerdictBadge';
import { paths } from '@/routes/paths';
import {
  LANGUAGE_LABELS,
  type SubmissionSummary,
} from '@/types/submissions';
import { cn } from '@/utils/cn';

interface SubmissionsTableProps {
  submissions: SubmissionSummary[];
  isFetching?: boolean;
  /** Hide the Problem column when scoped to one problem. */
  hideProblemColumn?: boolean;
}

function formatWhen(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SubmissionsTable({
  submissions,
  isFetching = false,
  hideProblemColumn = false,
}: SubmissionsTableProps) {
  return (
    <div
      className={cn(
        'relative overflow-x-auto rounded-lg border border-border',
        isFetching && 'opacity-80',
      )}
    >
      <table className="w-full min-w-[640px] caption-bottom border-collapse text-sm">
        <caption className="sr-only">Submission history</caption>
        <thead className="sticky top-0 z-10 border-b border-border bg-[#151820]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Verdict
            </th>
            {!hideProblemColumn ? (
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                Problem
              </th>
            ) : null}
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Language
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Runtime
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Memory
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
              Submitted
            </th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((row) => {
            const runtime = row.runtimeMs ?? row.runtime ?? null;
            const memory = row.memoryKb ?? row.memory ?? null;
            return (
              <tr
                key={row.id}
                className="border-b border-border/80 transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3">
                  <Link
                    to={paths.submissionDetail(row.id)}
                    className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <VerdictBadge verdict={row.verdict} status={row.status} />
                  </Link>
                </td>
                {!hideProblemColumn ? (
                  <td className="px-4 py-3">
                    {row.problem ? (
                      <Link
                        to={paths.problemDetail(row.problem.slug)}
                        className="font-medium text-white hover:text-primary"
                      >
                        {row.problem.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ) : null}
                <td className="px-4 py-3 text-muted-foreground">
                  {LANGUAGE_LABELS[row.language] ?? row.language}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {runtime != null ? `${runtime} ms` : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {memory != null ? `${memory} KB` : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <Link
                    to={paths.submissionDetail(row.id)}
                    className="hover:text-white"
                  >
                    {formatWhen(row.submittedAt ?? row.createdAt)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
