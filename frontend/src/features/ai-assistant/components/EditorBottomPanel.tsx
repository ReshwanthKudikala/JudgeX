import { memo, useCallback, useState } from 'react';

import {
  LearningAssistantPanel,
  type CoachPendingIntent,
} from '@/features/ai-assistant/components/LearningAssistantPanel';
import { COMPILE_ERROR_ACTION } from '@/features/ai-assistant/coach-actions';
import {
  ConsoleTabs,
  type RunConsoleResult,
  type WorkspaceMode,
} from '@/features/submissions/components/ConsoleTabs';
import type { Submission } from '@/types/submissions';
import type { CoachLastRunResult, CoachLastSubmission } from '@/types/ai-assistant';
import { cn } from '@/utils/cn';

interface EditorBottomPanelProps {
  problemId: string;
  language: 'python' | 'cpp';
  getSourceCode: () => string;
  mode: WorkspaceMode;
  onModeChange?: (mode: WorkspaceMode) => void;
  runResult?: RunConsoleResult | null;
  runInput?: string;
  onRunInputChange?: (value: string) => void;
  hasRunResult?: boolean;
  hasSubmissionResult?: boolean;
  /** Submit-mode submission only. */
  submission: Submission | null;
  timeLimitMs?: number | null;
  className?: string;
}

function toCoachRun(run: RunConsoleResult | null | undefined): CoachLastRunResult | null {
  if (!run) return null;
  return {
    status: run.status ?? null,
    compileSuccess: run.compileSuccess ?? null,
    stderr: run.stderr ?? null,
    results: (run.results ?? []).map((r, index) => ({
      index: r.index ?? index,
      status: null,
      passed: r.passed ?? null,
      input: r.input ?? null,
      expectedOutput: r.expectedOutput ?? null,
      actualOutput: r.actualOutput ?? null,
      stderr: r.stderr ?? null,
      runtimeMs: r.runtimeMs ?? null,
    })),
    passedCount: run.passedCount ?? null,
    totalCount: run.totalCount ?? null,
  };
}

function toCoachSubmission(sub: Submission | null | undefined): CoachLastSubmission | null {
  if (!sub) return null;
  return {
    id: sub.id,
    status: sub.status ?? null,
    verdict: sub.verdict ?? null,
    compileOutput: sub.compileOutput ?? null,
    stderr: sub.stderr ?? null,
    executionError: sub.executionError ?? null,
    runtimeMs: sub.runtimeMs ?? sub.executionTime ?? null,
    memoryKb: sub.memoryKb ?? null,
    passedTests: sub.passedTests ?? null,
    totalTests: sub.totalTests ?? null,
    failedTestIndex: sub.failedTestIndex ?? null,
  };
}

/**
 * Docked bottom workspace under the editor — Idle / Run / Submission + AI Coach.
 */
export const EditorBottomPanel = memo(function EditorBottomPanel({
  problemId,
  language,
  getSourceCode,
  mode,
  onModeChange,
  runResult = null,
  runInput = '',
  onRunInputChange,
  hasRunResult = false,
  hasSubmissionResult = false,
  submission,
  timeLimitMs = null,
  className,
}: EditorBottomPanelProps) {
  const [pendingIntent, setPendingIntent] = useState<CoachPendingIntent | null>(null);

  const getLastRunResult = useCallback(() => toCoachRun(runResult), [runResult]);
  const getLastSubmission = useCallback(
    () => toCoachSubmission(submission),
    [submission],
  );

  const openCompileErrorCoach = useCallback(() => {
    setPendingIntent({
      action: COMPILE_ERROR_ACTION.action,
      label: COMPILE_ERROR_ACTION.label,
      message: COMPILE_ERROR_ACTION.message,
      nonce: Date.now(),
    });
  }, []);

  return (
    <ConsoleTabs
      mode={mode}
      onModeChange={onModeChange}
      runResult={runResult}
      runInput={runInput}
      onRunInputChange={onRunInputChange}
      hasRunResult={hasRunResult}
      hasSubmissionResult={hasSubmissionResult}
      submission={mode === 'submit' ? submission : null}
      timeLimitMs={timeLimitMs}
      onOpenAiCoach={openCompileErrorCoach}
      embedded
      className={cn('min-h-0 flex-1', className)}
      aiPanel={
        <LearningAssistantPanel
          problemId={problemId}
          language={language}
          getSourceCode={getSourceCode}
          submissionId={submission?.id ?? null}
          getLastRunResult={getLastRunResult}
          getLastSubmission={getLastSubmission}
          pendingIntent={pendingIntent}
          onPendingIntentConsumed={() => setPendingIntent(null)}
          className="min-h-0 gap-2"
        />
      }
    />
  );
});
