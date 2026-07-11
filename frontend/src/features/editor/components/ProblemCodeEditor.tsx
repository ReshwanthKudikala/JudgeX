import { lazy, Suspense, useCallback, memo } from 'react';

import { EditorActions } from '@/features/editor/components/EditorActions';
import { EditorToolbar } from '@/features/editor/components/EditorToolbar';
import { ConsolePanel } from '@/features/editor/components/ConsolePanel';
import { useEditor } from '@/features/editor/hooks/useEditor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';

const MonacoEditor = lazy(() =>
  import('@/features/editor/components/MonacoEditor').then((m) => ({
    default: m.MonacoEditor,
  })),
);

interface ProblemCodeEditorProps {
  problemSlug: string;
  className?: string;
}

const COMING_SOON = 'Submission coming next sprint.';

/**
 * Full editor panel that drops into the Sprint 22 reserved slot.
 * Layout chrome (toolbar / editor / actions / console) stays fixed for Sprint 24.
 */
export const ProblemCodeEditor = memo(function ProblemCodeEditor({
  problemSlug,
  className,
}: ProblemCodeEditorProps) {
  const { toast } = useToast();

  const showComingSoon = useCallback(() => {
    toast({
      title: COMING_SOON,
      variant: 'default',
    });
  }, [toast]);

  const {
    language,
    code,
    setCode,
    setLanguage,
    consoleState,
    isDirty,
    run,
    submit,
  } = useEditor({
    problemSlug,
    onRunPlaceholder: showComingSoon,
    onSubmitPlaceholder: showComingSoon,
  });

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
        onRun={() => run?.()}
        onSubmit={() => submit?.()}
      />

      <ConsolePanel state={consoleState} />
    </div>
  );
});
