import { lazy, Suspense, useCallback, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';

import { EditorActions } from '@/features/editor/components/EditorActions';
import { EditorToolbar } from '@/features/editor/components/EditorToolbar';
import { useEditor } from '@/features/editor/hooks/useEditor';
import { ConsoleTabs } from '@/features/submissions/components/ConsoleTabs';
import { SubmissionStatus } from '@/features/submissions/components/SubmissionStatus';
import {
  getSubmissionErrorMessage,
  useSubmission,
} from '@/features/submissions/hooks/useSubmission';
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

interface ProblemCodeEditorProps {
  problemSlug: string;
  /** Backend POST /submissions requires problemId (UUID), not slug. */
  problemId: string;
  className?: string;
}

/**
 * Editor panel with Submit → poll → verdict/console (Sprint 24).
 * Layout chrome unchanged from Sprint 23.
 */
export const ProblemCodeEditor = memo(function ProblemCodeEditor({
  problemSlug,
  problemId,
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
  } = useSubmission();

  const busy = isSubmitting || isPolling;

  const handleRun = useCallback(() => {
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
        description: 'See the console for details.',
        variant: submission.verdict === 'compile_error' ? 'default' : 'error',
      });
    }
  }, [isTerminal, submission?.verdict, submission?.id, success, toast]);

  return (
    <div
      className={cn(
        'flex h-full min-h-[420px] flex-col rounded-lg border border-border bg-card',
        className,
      )}
      aria-label="Code editor"
    >
      <EditorToolbar
        language={language}
        onLanguageChange={setLanguage}
        isDirty={isDirty}
      />

      <div className="relative flex min-h-[240px] flex-1 flex-col overflow-hidden">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center bg-[#0c0e12] text-sm text-muted">
              Loading editor…
            </div>
          }
        >
          <MonacoEditor language={language} value={code} onChange={setCode} />
        </Suspense>
      </div>

      <EditorActions
        onRun={handleRun}
        onSubmit={() => {
          void handleSubmit();
        }}
        submitDisabled={busy}
        submitLoading={isSubmitting}
      />

      <SubmissionStatus
        submission={submission}
        isSubmitting={isSubmitting}
        isPolling={isPolling}
      />

      <ConsoleTabs
        submission={submission}
        aiExplanation={aiExplanation}
        aiAvailable={aiAvailable}
        aiLoading={aiLoading}
      />
    </div>
  );
});
