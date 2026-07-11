import { memo, useEffect, useMemo, useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { AiExplanation } from '@/features/submissions/components/AiExplanation';
import { CompileOutput } from '@/features/submissions/components/CompileOutput';
import { SubmissionDetails } from '@/features/submissions/components/SubmissionDetails';
import { VerdictBadge } from '@/features/submissions/components/VerdictBadge';
import type { AiCompileExplanation, Submission } from '@/types/submissions';
import { cn } from '@/utils/cn';

export type ConsoleTab = 'output' | 'error' | 'ai';

interface ConsoleTabsProps {
  submission: Submission | null;
  aiExplanation: AiCompileExplanation | null;
  aiAvailable: boolean;
  aiLoading?: boolean;
  className?: string;
}

/**
 * Console region under the editor.
 * Tabs: Output | Error | AI Explanation (AI hidden when unavailable).
 */
export const ConsoleTabs = memo(function ConsoleTabs({
  submission,
  aiExplanation,
  aiAvailable,
  aiLoading = false,
  className,
}: ConsoleTabsProps) {
  const showAi = aiAvailable || (submission?.verdict === 'compile_error' && aiLoading);

  const defaultTab: ConsoleTab = useMemo(() => {
    if (submission?.verdict === 'compile_error') return showAi ? 'ai' : 'error';
    if (submission?.verdict && submission.verdict !== 'accepted') return 'error';
    return 'output';
  }, [submission?.verdict, showAi]);

  const [tab, setTab] = useState<ConsoleTab>(defaultTab);

  useEffect(() => {
    setTab((prev) => {
      if (!showAi && prev === 'ai') return 'error';
      return defaultTab;
    });
  }, [defaultTab, showAi]);

  const outputText = buildOutputText(submission);
  const errorText = buildErrorText(submission);

  return (
    <div
      className={cn('border-t border-border bg-[#0c0e12] px-3 py-2', className)}
      aria-label="Execution console"
      role="region"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Console
        </p>
        {submission ? (
          <VerdictBadge verdict={submission.verdict} status={submission.status} />
        ) : null}
      </div>

      {submission ? <SubmissionDetails submission={submission} /> : null}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ConsoleTab)}
        defaultValue={defaultTab}
        className="mt-3"
      >
        <TabsList className="h-8">
          <TabsTrigger value="output" className="px-2.5 py-1 text-xs">
            Output
          </TabsTrigger>
          <TabsTrigger value="error" className="px-2.5 py-1 text-xs">
            Error
          </TabsTrigger>
          {showAi ? (
            <TabsTrigger value="ai" className="px-2.5 py-1 text-xs">
              AI Explanation
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="output" className="mt-2">
          <pre className="min-h-[2.5rem] whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
            {outputText || '—'}
          </pre>
        </TabsContent>

        <TabsContent value="error" className="mt-2 space-y-2">
          {submission?.verdict === 'compile_error' ? (
            <CompileOutput output={submission.compileOutput} />
          ) : (
            <pre className="min-h-[2.5rem] whitespace-pre-wrap break-words font-mono text-xs text-error">
              {errorText || '—'}
            </pre>
          )}
        </TabsContent>

        {showAi ? (
          <TabsContent value="ai" className="mt-2">
            <AiExplanation
              explanation={aiExplanation}
              loading={aiLoading}
              unavailable={!aiAvailable && !aiLoading}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
});

function buildOutputText(submission: Submission | null): string {
  if (!submission) return '';
  if (submission.verdict === 'accepted') {
    return 'All test cases passed.';
  }
  if (submission.status === 'queued') return 'Waiting in queue…';
  if (submission.status === 'running') return 'Running against test cases…';
  if (submission.verdict === 'wrong_answer') {
    const idx =
      submission.failedTestIndex != null
        ? ` (failed test #${submission.failedTestIndex})`
        : '';
    return `Wrong Answer${idx}`;
  }
  return '';
}

function buildErrorText(submission: Submission | null): string {
  if (!submission) return '';
  if (submission.verdict === 'compile_error') {
    return submission.compileOutput ?? 'Compilation failed.';
  }
  if (submission.verdict === 'runtime_error') {
    return 'Runtime Error';
  }
  if (submission.verdict === 'tle') {
    return 'Time Limit Exceeded';
  }
  if (submission.status === 'error') {
    return 'Judging failed.';
  }
  return submission.compileOutput ?? '';
}
