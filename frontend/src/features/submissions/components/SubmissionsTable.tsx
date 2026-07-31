import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        'relative overflow-x-auto rounded-lg border border-border shadow-card transition-opacity duration-150',
        isFetching && 'opacity-80',
      )}
    >
      <table className="w-full min-w-[640px] caption-bottom border-collapse text-sm">
        <caption className="sr-only">My submissions</caption>
        <thead className="sticky top-0 z-10 border-b border-border bg-surface">
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
              Submitted At
            </th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((row) => {
            const id = row.submissionId ?? row.id;
            const runtime = row.runtime ?? row.runtimeMs ?? null;
            const title = row.problem?.title ?? row.problemTitle ?? '—';

            return (
              <tr
                key={id}
                role="link"
                tabIndex={0}
                aria-label={`Open submission for ${title}`}
                className="cursor-pointer border-b border-border/80 transition-colors duration-150 hover:bg-overlay focus-visible:bg-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                onClick={() => navigate(paths.submissionDetail(id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(paths.submissionDetail(id));
                  }
                }}
              >
                <td className="px-4 py-3">
                  <VerdictBadge verdict={row.verdict} status={row.status} />
                </td>
                {!hideProblemColumn ? (
                  <td className="px-4 py-3 font-medium text-foreground">{title}</td>
                ) : null}
                <td className="px-4 py-3 text-muted-foreground">
                  {LANGUAGE_LABELS[row.language] ?? row.language}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {runtime != null ? `${runtime} ms` : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatWhen(row.submittedAt ?? row.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
