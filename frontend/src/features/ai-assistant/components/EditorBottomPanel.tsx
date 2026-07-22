import { memo } from 'react';

import { LearningAssistantPanel } from '@/features/ai-assistant/components/LearningAssistantPanel';
import {
  ConsoleTabs,
  type RunConsoleResult,
  type WorkspaceMode,
} from '@/features/submissions/components/ConsoleTabs';
import type { AiCompileExplanation, Submission } from '@/types/submissions';
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
  aiExplanation: AiCompileExplanation | null;
  aiAvailable: boolean;
  aiLoading?: boolean;
  onRequestCompileExplanation?: () => void;
  className?: string;
}

/**
 * Docked bottom workspace under the editor — Idle / Run / Submission + AI.
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
  aiExplanation,
  aiAvailable,
  aiLoading = false,
  onRequestCompileExplanation,
  className,
}: EditorBottomPanelProps) {
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
      aiExplanation={aiExplanation}
      aiAvailable={aiAvailable}
      aiLoading={aiLoading}
      onRequestCompileExplanation={onRequestCompileExplanation}
      embedded
      className={cn('min-h-0 flex-1', className)}
      aiPanel={
        <LearningAssistantPanel
          problemId={problemId}
          language={language}
          getSourceCode={getSourceCode}
          submissionId={submission?.id ?? null}
          className="min-h-0 gap-2"
        />
      }
    />
  );
});
