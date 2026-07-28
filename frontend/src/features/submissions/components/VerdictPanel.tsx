import type { ReactNode } from 'react';

import { CompileOutput } from '@/features/submissions/components/CompileOutput';
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

  if (!verdict) {
    return (
      <Panel tone="neutral" title={status === 'running' ? 'Running…' : 'Queued'}>
        <p className="text-sm text-muted-foreground">
          This submission is still being judged.
        </p>
      </Panel>
    );
  }

  if (verdict === 'accepted') {
    return (
      <Panel tone="success" title="Accepted">
        <p className="text-sm text-success">✔ Accepted</p>
      </Panel>
    );
  }

  if (verdict === 'wrong_answer') {
    const caseNumber =
      submission.failedTestIndex != null
        ? `#${submission.failedTestIndex + 1}`
        : null;
    return (
      <Panel tone="error" title="Wrong Answer">
        <p className="text-sm text-error">Wrong Answer</p>
        {caseNumber ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Failed testcase:{' '}
            <span className="font-mono text-white">{caseNumber}</span>
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          Hidden testcase contents are not shown.
        </p>
      </Panel>
    );
  }

  if (verdict === 'compile_error') {
    return (
      <Panel tone="warn" title="Compile Error">
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
      <Panel tone="error" title="Runtime Error">
        {message ? (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
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
      <Panel tone="warn" title="Time Limit Exceeded">
        <p className="text-sm text-amber-200">
          {submission.executionError?.trim() ||
            'Time Limit Exceeded: execution exceeded the allowed time limit.'}
        </p>
      </Panel>
    );
  }

  return (
    <Panel tone="error" title={VERDICT_LABELS[verdict] ?? 'Error'}>
      {(submission.executionError || submission.stderr || submission.compileOutput)?.trim() ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
          {submission.executionError ||
            submission.stderr ||
            submission.compileOutput}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">
          {VERDICT_LABELS[verdict]}
        </p>
      )}
    </Panel>
  );
}

function Panel({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'success' | 'error' | 'warn' | 'neutral';
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-lg border p-4',
        tone === 'success' && 'border-success/30 bg-success/5',
        tone === 'error' && 'border-error/30 bg-error/5',
        tone === 'warn' && 'border-amber-400/30 bg-amber-400/5',
        tone === 'neutral' && 'border-border bg-card',
      )}
    >
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}
