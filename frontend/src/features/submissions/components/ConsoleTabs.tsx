import { memo, useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { AiExplanation } from '@/features/submissions/components/AiExplanation';
import { CompileOutput } from '@/features/submissions/components/CompileOutput';
import type { AiCompileExplanation, Submission } from '@/types/submissions';
import { VERDICT_LABELS } from '@/types/submissions';
import { cn } from '@/utils/cn';

/** Bottom workspace mode — Run and Submit are mutually exclusive views. */
export type WorkspaceMode = 'idle' | 'run' | 'submit';

/** @deprecated Prefer WorkspaceMode */
export type ConsoleAction = WorkspaceMode;

/** Run-only payload. Never shared with submission state. */
export interface RunConsoleResult {
  stdin?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  pending?: boolean;
  /** Execution status from POST /code/run (not a graded verdict). */
  status?: string | null;
  exitCode?: number | null;
  timedOut?: boolean;
  compileSuccess?: boolean | null;
}

export type ConsoleTab = 'workspace' | 'ai';

interface ConsoleTabsProps {
  mode: WorkspaceMode;
  /** Optional: jump back to a previous mode when both results exist. */
  onModeChange?: (mode: WorkspaceMode) => void;
  runResult?: RunConsoleResult | null;
  /** Stdin editor for Run mode (owned by parent). */
  runInput?: string;
  onRunInputChange?: (value: string) => void;
  /** Submission for Submit mode only — parent must not pass run data here. */
  submission: Submission | null;
  /** True when a prior run result exists (enables mode chip). */
  hasRunResult?: boolean;
  /** True when a prior submission result exists (enables mode chip). */
  hasSubmissionResult?: boolean;
  timeLimitMs?: number | null;
  aiExplanation: AiCompileExplanation | null;
  aiAvailable: boolean;
  aiLoading?: boolean;
  onRequestCompileExplanation?: () => void;
  aiPanel?: ReactNode;
  embedded?: boolean;
  className?: string;
}

const tabTriggerClass =
  'h-7 rounded-none border-b-2 bg-transparent px-2.5 py-0 text-[11px] shadow-none hover:bg-transparent';

/**
 * Bottom workspace: Idle | Run console | Submission result + AI.
 * Interaction model: each action owns a dedicated mode (not a shared console).
 */
export const ConsoleTabs = memo(function ConsoleTabs({
  mode,
  onModeChange,
  runResult = null,
  runInput = '',
  onRunInputChange,
  submission,
  hasRunResult = false,
  hasSubmissionResult = false,
  timeLimitMs = null,
  aiExplanation,
  aiAvailable,
  aiLoading = false,
  onRequestCompileExplanation,
  aiPanel,
  embedded = false,
  className,
}: ConsoleTabsProps) {
  const [tab, setTab] = useState<ConsoleTab>('workspace');

  useEffect(() => {
    if (mode === 'run' || mode === 'submit') {
      setTab('workspace');
    }
  }, [mode, submission?.id, submission?.status, submission?.verdict, runResult?.pending]);

  const workspaceLabel = mode === 'submit' ? 'Result' : 'Console';

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col bg-[#0c0e12]',
        !embedded && 'border-t border-border',
        className,
      )}
      aria-label="Bottom workspace"
      role="region"
    >
      <Tabs
        defaultValue="workspace"
        value={tab}
        onValueChange={(v) => setTab(v as ConsoleTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border/50 px-2">
          <TabsList className="h-8 gap-0 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger value="workspace" className={tabTriggerClass}>
              {workspaceLabel}
            </TabsTrigger>
            {aiPanel ? (
              <TabsTrigger value="ai" className={tabTriggerClass}>
                AI
              </TabsTrigger>
            ) : null}
          </TabsList>

          <ModeBadge
            mode={mode}
            hasRunResult={hasRunResult}
            hasSubmissionResult={hasSubmissionResult}
            onModeChange={onModeChange}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TabsContent value="workspace" className="mt-0 h-full p-0">
            {mode === 'idle' ? <IdleWorkspace /> : null}
            {mode === 'run' ? (
              <RunWorkspace
                result={runResult}
                runInput={runInput}
                onRunInputChange={onRunInputChange}
              />
            ) : null}
            {mode === 'submit' ? (
              <SubmissionWorkspace
                submission={submission}
                timeLimitMs={timeLimitMs}
                aiExplanation={aiExplanation}
                aiAvailable={aiAvailable}
                aiLoading={aiLoading}
                onRequestCompileExplanation={onRequestCompileExplanation}
              />
            ) : null}
          </TabsContent>

          {aiPanel ? (
            <TabsContent value="ai" className="mt-0 h-full p-2">
              {aiPanel}
            </TabsContent>
          ) : null}
        </div>
      </Tabs>
    </div>
  );
});

function ModeBadge({
  mode,
  hasRunResult,
  hasSubmissionResult,
  onModeChange,
}: {
  mode: WorkspaceMode;
  hasRunResult: boolean;
  hasSubmissionResult: boolean;
  onModeChange?: (mode: WorkspaceMode) => void;
}) {
  if (mode === 'idle') return null;

  return (
    <div className="ml-auto flex items-center gap-1">
      {hasRunResult && onModeChange ? (
        <button
          type="button"
          onClick={() => onModeChange('run')}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
            mode === 'run'
              ? 'bg-sky-500/20 text-sky-300'
              : 'text-muted/70 hover:bg-white/5 hover:text-muted-foreground',
          )}
        >
          Run
        </button>
      ) : mode === 'run' ? (
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
          Run
        </span>
      ) : null}

      {hasSubmissionResult && onModeChange ? (
        <button
          type="button"
          onClick={() => onModeChange('submit')}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
            mode === 'submit'
              ? 'bg-violet-500/20 text-violet-300'
              : 'text-muted/70 hover:bg-white/5 hover:text-muted-foreground',
          )}
        >
          Submission
        </button>
      ) : mode === 'submit' ? (
        <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
          Submission
        </span>
      ) : null}
    </div>
  );
}

function IdleWorkspace() {
  return (
    <div className="flex h-full min-h-[72px] flex-col items-start justify-center px-3 py-4">
      <p className="text-sm text-muted-foreground">
        Run your code or submit a solution.
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted/60">
        Console is empty until you Run or Submit.
      </p>
    </div>
  );
}

function RunWorkspace({
  result,
  runInput,
  onRunInputChange,
}: {
  result: RunConsoleResult | null;
  runInput: string;
  onRunInputChange?: (value: string) => void;
}) {
  const pending = Boolean(result?.pending);
  const stdout = result?.stdout != null ? result.stdout : null;
  const stderr = result?.stderr?.trim() ? result.stderr : null;
  const shownInput = result?.stdin ?? runInput;
  const statusLabel =
    result?.status === 'compile_error'
      ? 'Compile error'
      : result?.status === 'runtime_error'
        ? 'Runtime error'
        : result?.status === 'time_limit' || result?.timedOut
          ? 'Timed out'
          : result?.status === 'ok'
            ? 'Finished'
            : result?.status ?? null;

  return (
    <div className="space-y-3 px-3 py-2.5">
      <p className="text-[11px] font-medium text-sky-300/90">
        Run result — sample I/O only (not a judge verdict)
      </p>

      <Field label="Input">
        {onRunInputChange && !pending ? (
          <textarea
            value={runInput}
            onChange={(e) => onRunInputChange(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="stdin for your next Run…"
            className={cn(
              'w-full resize-y rounded border border-border/50 bg-black/30 px-2 py-1.5',
              'font-mono text-[12px] leading-relaxed text-muted-foreground',
              'placeholder:text-muted/50 focus:border-sky-500/40 focus:outline-none',
            )}
            aria-label="Run input"
          />
        ) : (
          <TerminalPre className="rounded border border-border/40 bg-black/20 px-2 py-1.5">
            {shownInput.trim() ? shownInput : '(empty)'}
          </TerminalPre>
        )}
      </Field>

      <Field label="Output">
        {pending ? (
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" aria-hidden />
            Running…
          </div>
        ) : (
          <TerminalPre className="rounded border border-border/40 bg-black/20 px-2 py-1.5">
            {stdout != null && String(stdout).length > 0 ? stdout : '(empty)'}
          </TerminalPre>
        )}
      </Field>

      {stderr ? (
        <Field
          label={
            result?.status === 'compile_error' ? 'Compiler output' : 'stderr'
          }
        >
          <TerminalPre className="rounded border border-error/30 bg-error/5 px-2 py-1.5 text-error">
            {stderr}
          </TerminalPre>
        </Field>
      ) : null}

      {!pending && result && !result.pending ? (
        <MetaRow
          items={[
            statusLabel ? { label: 'Status', value: statusLabel } : null,
            result.exitCode != null
              ? { label: 'Exit', value: String(result.exitCode) }
              : null,
            result.runtimeMs != null
              ? { label: 'Runtime', value: `${result.runtimeMs} ms` }
              : null,
            result.memoryKb != null
              ? { label: 'Memory', value: `${result.memoryKb} KB` }
              : null,
            result.timedOut ? { label: 'Timed out', value: 'yes' } : null,
          ]}
        />
      ) : null}

      {!pending && !result ? (
        <p className="font-mono text-[11px] text-muted/60">
          Press Run to execute against the input above.
        </p>
      ) : null}
    </div>
  );
}

function SubmissionWorkspace({
  submission,
  timeLimitMs,
  aiExplanation,
  aiAvailable,
  aiLoading,
  onRequestCompileExplanation,
}: {
  submission: Submission | null;
  timeLimitMs?: number | null;
  aiExplanation: AiCompileExplanation | null;
  aiAvailable: boolean;
  aiLoading: boolean;
  onRequestCompileExplanation?: () => void;
}) {
  if (!submission) {
    return (
      <div className="px-3 py-3 font-mono text-xs text-muted-foreground">
        Submitting…
      </div>
    );
  }

  if (submission.status === 'queued' || submission.status === 'running') {
    return (
      <div className="flex items-center gap-2 px-3 py-3 font-mono text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" aria-hidden />
        {submission.status === 'queued'
          ? 'Waiting in queue…'
          : 'Judging against test cases…'}
      </div>
    );
  }

  const verdict = submission.verdict;
  if (!verdict) {
    return (
      <div className="px-3 py-3 text-xs text-muted">
        Judging finished without a verdict.
      </div>
    );
  }

  if (verdict === 'accepted') {
    return (
      <VerdictCard
        ok
        title="Accepted"
        rows={compactRows([
          passedTestsRow(submission),
          runtimeRow(submission),
          memoryRow(submission),
        ])}
      />
    );
  }

  if (verdict === 'wrong_answer') {
    const yours = submission.stdout?.trim() ? submission.stdout : null;
    return (
      <VerdictCard
        ok={false}
        title="Wrong Answer"
        rows={compactRows([
          passedTestsRow(submission),
          submission.failedTestIndex != null
            ? { label: 'Failed Test', value: `#${submission.failedTestIndex + 1}` }
            : null,
          // Expected output is not in the submission API payload — omit if absent.
          yours
            ? { label: 'Your Output', value: yours, mono: true, block: true }
            : null,
          runtimeRow(submission),
          memoryRow(submission),
        ])}
      />
    );
  }

  if (verdict === 'compile_error') {
    return (
      <div className="space-y-3 px-3 py-2.5">
        <VerdictHeader ok={false} title="Compilation Error" />
        {submission.compileOutput?.trim() ? (
          <Field label="Compiler output">
            <CompileOutput output={submission.compileOutput} />
          </Field>
        ) : null}
        <CompileExplainSection
          aiExplanation={aiExplanation}
          aiAvailable={aiAvailable}
          aiLoading={aiLoading}
          onRequestCompileExplanation={onRequestCompileExplanation}
        />
      </div>
    );
  }

  if (verdict === 'runtime_error') {
    const msg = submission.stderr?.trim() || null;
    return (
      <VerdictCard
        ok={false}
        title="Runtime Error"
        rows={compactRows([
          msg ? { label: 'Runtime error', value: msg, mono: true, block: true } : null,
        ])}
      />
    );
  }

  if (verdict === 'tle') {
    return (
      <VerdictCard
        ok={false}
        title="Time Limit Exceeded"
        rows={compactRows([
          runtimeRow(submission),
          timeLimitMs != null
            ? { label: 'Time Limit', value: `${timeLimitMs} ms` }
            : null,
        ])}
      />
    );
  }

  if (verdict === 'memory_limit_exceeded') {
    return (
      <VerdictCard
        ok={false}
        title={VERDICT_LABELS[verdict]}
        rows={compactRows([runtimeRow(submission), memoryRow(submission)])}
      />
    );
  }

  return (
    <VerdictCard
      ok={false}
      title={VERDICT_LABELS[verdict] ?? 'Error'}
      rows={compactRows([
        submission.stderr?.trim()
          ? { label: 'Details', value: submission.stderr, mono: true, block: true }
          : submission.compileOutput?.trim()
            ? {
                label: 'Details',
                value: submission.compileOutput,
                mono: true,
                block: true,
              }
            : null,
      ])}
    />
  );
}

function CompileExplainSection({
  aiExplanation,
  aiAvailable,
  aiLoading,
  onRequestCompileExplanation,
}: {
  aiExplanation: AiCompileExplanation | null;
  aiAvailable: boolean;
  aiLoading: boolean;
  onRequestCompileExplanation?: () => void;
}) {
  if (aiAvailable || aiLoading) {
    return (
      <AiExplanation
        explanation={aiExplanation}
        loading={aiLoading}
        unavailable={!aiAvailable && !aiLoading}
      />
    );
  }

  if (!onRequestCompileExplanation) return null;

  return (
    <div className="space-y-2 border-t border-border/40 pt-2">
      <p className="text-[11px] text-muted">Need help with this compile error?</p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onRequestCompileExplanation()}
      >
        Explain compile error
      </Button>
    </div>
  );
}

type DetailRow = {
  label: string;
  value: string;
  mono?: boolean;
  block?: boolean;
};

function VerdictCard({
  ok,
  title,
  rows,
}: {
  ok: boolean;
  title: string;
  rows: DetailRow[];
}) {
  return (
    <div className="space-y-2.5 px-3 py-2.5">
      <p className="text-[11px] font-medium text-violet-300/90">
        Submission result — full judge verdict
      </p>
      <VerdictHeader ok={ok} title={title} />
      {rows.length > 0 ? (
        <div className="rounded-md border border-border/50 bg-white/[0.02] px-2.5 py-2">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
            {rows.map((row) =>
              row.block ? (
                <div key={row.label} className="col-span-full">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted/70">
                    {row.label}
                  </dt>
                  <dd
                    className={cn(
                      'mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-muted-foreground',
                      row.mono && 'font-mono',
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ) : (
                <div key={row.label}>
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted/70">
                    {row.label}
                  </dt>
                  <dd
                    className={cn(
                      'mt-0.5 text-[12px] text-muted-foreground',
                      row.mono && 'font-mono',
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function VerdictHeader({ ok, title }: { ok: boolean; title: string }) {
  return (
    <p className={cn('text-sm font-semibold', ok ? 'text-success' : 'text-error')}>
      {ok ? '✅' : '❌'} {title}
    </p>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted/70">
        {label}
      </p>
      {children}
    </div>
  );
}

function TerminalPre({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        'whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-muted-foreground',
        className,
      )}
    >
      {children}
    </pre>
  );
}

function MetaRow({
  items,
}: {
  items: Array<{ label: string; value: string } | null>;
}) {
  const rows = items.filter(Boolean) as Array<{ label: string; value: string }>;
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/40 pt-2 font-mono text-[11px] text-muted">
      {rows.map((r) => (
        <span key={r.label}>
          <span className="text-muted/70">{r.label}:</span> {r.value}
        </span>
      ))}
    </div>
  );
}

function compactRows(rows: Array<DetailRow | null | undefined>): DetailRow[] {
  return rows.filter((r): r is DetailRow => Boolean(r));
}

function runtimeMsOf(s: Submission): number | null {
  const v = s.executionTime ?? s.runtimeMs ?? s.runtime ?? null;
  return typeof v === 'number' ? v : null;
}

function memoryKbOf(s: Submission): number | null {
  const v = s.memoryKb ?? s.memory ?? null;
  return typeof v === 'number' ? v : null;
}

function runtimeRow(s: Submission): DetailRow | null {
  const ms = runtimeMsOf(s);
  return ms != null ? { label: 'Runtime', value: `${ms} ms` } : null;
}

function memoryRow(s: Submission): DetailRow | null {
  const kb = memoryKbOf(s);
  return kb != null ? { label: 'Memory', value: `${kb} KB` } : null;
}

function passedTestsRow(s: Submission): DetailRow | null {
  if (s.passedTests == null || s.totalTests == null) return null;
  return {
    label: 'Passed Tests',
    value: `${s.passedTests} / ${s.totalTests}`,
  };
}
