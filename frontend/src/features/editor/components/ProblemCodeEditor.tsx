import { lazy, Suspense, useCallback, useEffect, useRef, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';

import { EditorBottomPanel } from '@/features/ai-assistant';
import { EditorActions } from '@/features/editor/components/EditorActions';
import { EditorToolbar } from '@/features/editor/components/EditorToolbar';
import { useEditor } from '@/features/editor/hooks/useEditor';
import type {
  RunConsoleResult,
  WorkspaceMode,
} from '@/features/submissions/components/ConsoleTabs';
import { SubmissionStatus } from '@/features/submissions/components/SubmissionStatus';
import {
  getSubmissionErrorMessage,
  useSubmission,
} from '@/features/submissions/hooks/useSubmission';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { VERDICT_LABELS } from '@/types/submissions';
import { cn } from '@/utils/cn';

const MonacoEditor = lazy(() =>
  import('@/features/editor/components/MonacoEditor').then((m) => ({
    default: m.MonacoEditor,
  })),
);

const V_STORAGE_ID = 'judgex-problem-v-split';
const V_PANEL_IDS = ['monaco', 'console'] as const;

interface ProblemCodeEditorProps {
  problemSlug: string;
  /** Backend POST /submissions requires problemId (UUID), not slug. */
  problemId: string;
  /** Used for TLE console copy when available. */
  timeLimitMs?: number | null;
  className?: string;
}

/**
 * Editor panel with Submit → poll → verdict/console (Sprint 24).
 * Sprint 29: Console | AI learning assistant under the editor.
 * Desktop: resizable Monaco / console split (persisted).
 * Workspace modes: Idle | Run | Submission (separate state).
 */
export const ProblemCodeEditor = memo(function ProblemCodeEditor({
  problemSlug,
  problemId,
  timeLimitMs = null,
  className,
}: ProblemCodeEditorProps) {
  const navigate = useNavigate();
  const { toast, success, error: errorToast } = useToast();
  const token = useAuthStore((s) => s.token);

  const {
    submit,
    submission,
    isSubmitting,
    isPolling,
    isTerminal,
    pollTimedOut,
    submitError,
    pollError,
    aiExplanation,
    aiAvailable,
    aiLoading,
    requestCompileExplanation,
  } = useSubmission();

  /**
   * Workspace mode is driven by the last action.
   * Run and Submit keep independent state — switching mode never merges them.
   */
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('idle');
  const [runInput, setRunInput] = useState('');
  const [runResult] = useState<RunConsoleResult | null>(null);

  const busy = isSubmitting || isPolling;
  const hasRunResult = runResult != null && !runResult.pending;
  const hasSubmissionResult = Boolean(
    submission && (submission.status === 'completed' || submission.status === 'error'),
  );

  const handleRun = useCallback(() => {
    // Enter Run mode without touching submission state.
    setWorkspaceMode('run');
    // Stub: keep any prior runResult; show empty run workspace until Run is wired.
    // Do not clear submission — it remains available via the Submission chip.
    toast({
      title: 'Run coming next sprint.',
      description: 'Use Submit to judge against the full test suite.',
      variant: 'default',
    });
  }, [toast]);

  const languageRef = useRef<'cpp' | 'python'>('python');
  const codeRef = useRef('');

  const handleSubmit = useCallback(async () => {
    if (!token) {
      errorToast('Sign in required', 'Please sign in to submit code.');
      navigate(paths.login, {
        state: { from: { pathname: paths.problemDetail(problemSlug) } },
      });
      return;
    }

    // Enter Submission mode without overwriting runResult / runInput.
    setWorkspaceMode('submit');

    try {
      await submit({
        problemId,
        language: languageRef.current,
        sourceCode: codeRef.current,
      });
    } catch {
      /* surfaced via submitError effect */
    }
  }, [token, errorToast, navigate, problemSlug, submit, problemId]);

  const { language, code, setCode, setLanguage, isDirty } = useEditor({
    problemSlug,
    onRun: handleRun,
    onSubmit: () => {
      void handleSubmit();
    },
    submitDisabled: busy,
  });

  languageRef.current = language;
  codeRef.current = code;

  const getSourceCode = useCallback(() => codeRef.current, []);

  useEffect(() => {
    if (!submitError) return;
    errorToast('Submission failed', getSubmissionErrorMessage(submitError));
  }, [submitError, errorToast]);

  useEffect(() => {
    if (!pollError) return;
    errorToast('Polling failed', getSubmissionErrorMessage(pollError));
  }, [pollError, errorToast]);

  useEffect(() => {
    if (!pollTimedOut) return;
    errorToast(
      'Judging timed out',
      'The judge did not finish in time. Check your submission history later.',
    );
  }, [pollTimedOut, errorToast]);

  const toastedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isTerminal || !submission?.verdict || !submission.id) return;
    const key = `${submission.id}:${submission.verdict}`;
    if (toastedKeyRef.current === key) return;
    toastedKeyRef.current = key;

    const label = VERDICT_LABELS[submission.verdict];
    if (submission.verdict === 'accepted') {
      success('Accepted', 'All tests passed.');
    } else {
      toast({
        title: label,
        description: 'See the Result panel for details.',
        variant: submission.verdict === 'compile_error' ? 'default' : 'error',
      });
    }
  }, [isTerminal, submission?.verdict, submission?.id, success, toast]);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: V_STORAGE_ID,
    panelIds: [...V_PANEL_IDS],
    storage: localStorage,
  });

  const monacoPane = (
    <div className="relative h-full min-h-0 overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-[#0c0e12] text-sm text-muted">
            Loading editor…
          </div>
        }
      >
        <MonacoEditor language={language} value={code} onChange={setCode} />
      </Suspense>
    </div>
  );

  const consoleDock = (
    <div className="flex h-full min-h-0 flex-col bg-[#0c0e12]">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/50 px-2">
        <div className="min-w-0 flex-1">
          {workspaceMode === 'submit' ? (
            <SubmissionStatus
              submission={submission}
              isSubmitting={isSubmitting}
              isPolling={isPolling}
            />
          ) : workspaceMode === 'run' ? (
            <p className="truncate text-xs text-sky-300/90">
              Run workspace
              {runResult?.pending ? ' · running…' : hasRunResult ? ' · ready' : ''}
            </p>
          ) : (
            <p className="truncate text-xs text-muted">Ready</p>
          )}
        </div>
        <EditorActions
          onRun={handleRun}
          onSubmit={() => {
            void handleSubmit();
          }}
          submitDisabled={busy}
          submitLoading={isSubmitting}
        />
      </div>
      <EditorBottomPanel
        problemId={problemId}
        language={language}
        getSourceCode={getSourceCode}
        mode={workspaceMode}
        onModeChange={setWorkspaceMode}
        runResult={runResult}
        runInput={runInput}
        onRunInputChange={setRunInput}
        hasRunResult={hasRunResult || workspaceMode === 'run'}
        hasSubmissionResult={hasSubmissionResult || workspaceMode === 'submit'}
        submission={submission}
        timeLimitMs={timeLimitMs}
        aiExplanation={aiExplanation}
        aiAvailable={aiAvailable}
        aiLoading={aiLoading}
        onRequestCompileExplanation={requestCompileExplanation}
      />
    </div>
  );

  return (
    <div
      className={cn(
        'flex h-full min-h-[420px] flex-col overflow-hidden bg-card lg:min-h-0',
        className,
      )}
      aria-label="Code editor"
    >
      <EditorToolbar
        language={language}
        onLanguageChange={setLanguage}
        isDirty={isDirty}
      />

      {isDesktop ? (
        <Group
          id={V_STORAGE_ID}
          orientation="vertical"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
          className="min-h-0 flex-1"
        >
          <Panel
            id="monaco"
            defaultSize="72"
            minSize={250}
            className="min-h-0 min-w-0"
          >
            {monacoPane}
          </Panel>

          <Separator
            className={cn(
              'h-1.5 shrink-0 bg-border transition-colors',
              'hover:bg-primary/50',
              'data-[separator=active]:bg-primary data-[separator=focus]:bg-primary/40',
            )}
            aria-label="Resize editor and console"
          />

          <Panel
            id="console"
            defaultSize="28"
            minSize={140}
            className="min-h-0 min-w-0"
          >
            {consoleDock}
          </Panel>
        </Group>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-[240px] flex-1 overflow-hidden">{monacoPane}</div>
          <div className="flex h-[clamp(180px,28%,240px)] shrink-0 flex-col border-t border-border">
            {consoleDock}
          </div>
        </div>
      )}
    </div>
  );
});
