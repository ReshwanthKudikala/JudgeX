import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  Terminal,
  XCircle,
} from 'lucide-react';

import { CompileOutput } from '@/features/submissions/components/CompileOutput';
import { VerdictBadge } from '@/features/submissions/components/VerdictBadge';
import {
  VERDICT_LABELS,
  type Submission,
} from '@/types/submissions';
import { cn } from '@/utils/cn';

interface VerdictPanelProps {
  submission: Submission;
}

/**
 * Verdict-specific detail panel for the submission details page.
 * Never renders hidden testcase input, expected output, or actual output.
 */
export function VerdictPanel({ submission }: VerdictPanelProps) {
  const { verdict, status } = submission;
  const runtime = submission.runtime ?? submission.runtimeMs ?? null;
  const memory = submission.memoryKb ?? submission.memory ?? null;

  if (!verdict) {
    return (
      <Panel
        tone="neutral"
        icon={<Hourglass className="h-5 w-5" />}
        title={status === 'running' ? 'Running…' : 'Queued'}
        badge={<VerdictBadge status={status} />}
      >
        <p className="text-sm text-muted-foreground">
          This submission is still being judged.
        </p>
      </Panel>
    );
  }

  if (verdict === 'accepted') {
    return (
      <Panel
        tone="success"
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Accepted"
        badge={<VerdictBadge verdict={verdict} />}
      >
        <p className="text-sm font-medium text-success">Solution accepted</p>
        <MetaGrid
          items={[
            runtime != null ? { label: 'Runtime', value: `${runtime} ms` } : null,
            memory != null ? { label: 'Memory', value: `${memory} KB` } : null,
            submission.passedTests != null && submission.totalTests != null
              ? {
                  label: 'Tests',
                  value: `${submission.passedTests}/${submission.totalTests}`,
                }
              : null,
          ]}
        />
      </Panel>
    );
  }

  if (verdict === 'wrong_answer') {
    const caseNumber =
      submission.failedTestIndex != null
        ? `#${submission.failedTestIndex + 1}`
        : null;
    return (
      <Panel
        tone="error"
        icon={<XCircle className="h-5 w-5" />}
        title="Wrong Answer"
        badge={<VerdictBadge verdict={verdict} />}
      >
        <MetaGrid
          items={[
            caseNumber
              ? { label: 'Failed testcase', value: caseNumber }
              : null,
            submission.passedTests != null && submission.totalTests != null
              ? {
                  label: 'Passed',
                  value: `${submission.passedTests}/${submission.totalTests}`,
                }
              : null,
          ]}
        />
        <p className="mt-3 text-xs text-muted">
          Hidden testcase contents are not shown.
        </p>
      </Panel>
    );
  }

  if (verdict === 'compile_error') {
    return (
      <Panel
        tone="warn"
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Compile Error"
        badge={<VerdictBadge verdict={verdict} />}
      >
        {submission.compileOutput?.trim() ? (
          <CompileOutput output={submission.compileOutput} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No compiler output was recorded.
          </p>
        )}
      </Panel>
    );
  }

  if (verdict === 'runtime_error') {
    const message =
      submission.executionError?.trim() ||
      submission.stderr?.trim() ||
      null;
    return (
      <Panel
        tone="error"
        icon={<Terminal className="h-5 w-5" />}
        title="Runtime Error"
        badge={<VerdictBadge verdict={verdict} />}
      >
        {message ? (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-editor p-3 font-mono text-xs text-muted-foreground">
            {message}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            The program exited with a runtime error.
          </p>
        )}
      </Panel>
    );
  }

  if (verdict === 'tle') {
    return (
      <Panel
        tone="warn"
        icon={<Clock className="h-5 w-5" />}
        title="Time Limit Exceeded"
        badge={<VerdictBadge verdict={verdict} />}
      >
        <p className="text-sm text-warning">
          {submission.executionError?.trim() ||
            'Execution exceeded the allowed time limit.'}
        </p>
        <MetaGrid
          items={[
            runtime != null ? { label: 'Runtime', value: `${runtime} ms` } : null,
          ]}
        />
      </Panel>
    );
  }

  return (
    <Panel
      tone="error"
      icon={<XCircle className="h-5 w-5" />}
      title={VERDICT_LABELS[verdict] ?? 'Error'}
      badge={<VerdictBadge verdict={verdict} />}
    >
      {(submission.executionError || submission.stderr || submission.compileOutput)?.trim() ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-editor p-3 font-mono text-xs text-muted-foreground">
          {submission.executionError ||
            submission.stderr ||
            submission.compileOutput}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">{VERDICT_LABELS[verdict]}</p>
      )}
    </Panel>
  );
}

function MetaGrid({
  items,
}: {
  items: Array<{ label: string; value: string } | null>;
}) {
  const visible = items.filter(Boolean) as Array<{ label: string; value: string }>;
  if (visible.length === 0) return null;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {visible.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-border/80 bg-background/60 px-3 py-2"
        >
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted">
            {item.label}
          </dt>
          <dd className="mt-0.5 font-mono text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Panel({
  title,
  tone,
  icon,
  badge,
  children,
}: {
  title: string;
  tone: 'success' | 'error' | 'warn' | 'neutral';
  icon: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-lg border p-4 shadow-card transition-colors duration-200',
        tone === 'success' && 'border-success/30 bg-success/5',
        tone === 'error' && 'border-error/30 bg-error/5',
        tone === 'warn' && 'border-warning/30 bg-warning/5',
        tone === 'neutral' && 'border-border bg-card',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md',
              tone === 'success' && 'bg-success/15 text-success',
              tone === 'error' && 'bg-error/15 text-error',
              tone === 'warn' && 'bg-warning/15 text-warning',
              tone === 'neutral' && 'bg-overlay text-muted',
            )}
            aria-hidden
          >
            {icon}
          </span>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}
