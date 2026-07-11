import { memo, useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { LearningAssistantPanel } from '@/features/ai-assistant';
import { ConsoleTabs } from '@/features/submissions/components/ConsoleTabs';
import type { AiCompileExplanation, Submission } from '@/types/submissions';
import { cn } from '@/utils/cn';

type BottomTab = 'console' | 'ai';

interface EditorBottomPanelProps {
  problemId: string;
  language: 'python' | 'cpp';
  getSourceCode: () => string;
  submission: Submission | null;
  aiExplanation: AiCompileExplanation | null;
  aiAvailable: boolean;
  aiLoading?: boolean;
  onRequestCompileExplanation?: () => void;
  className?: string;
}

/**
 * Bottom region under the editor: Console | AI Assistant.
 */
export const EditorBottomPanel = memo(function EditorBottomPanel({
  problemId,
  language,
  getSourceCode,
  submission,
  aiExplanation,
  aiAvailable,
  aiLoading = false,
  onRequestCompileExplanation,
  className,
}: EditorBottomPanelProps) {
  const [tab, setTab] = useState<BottomTab>('console');

  return (
    <div
      className={cn('border-t border-border bg-[#0c0e12] px-3 py-2', className)}
      aria-label="Editor tools"
      role="region"
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as BottomTab)}
        defaultValue="console"
      >
        <TabsList className="h-8">
          <TabsTrigger value="console" className="px-2.5 py-1 text-xs">
            Console
          </TabsTrigger>
          <TabsTrigger value="ai" className="px-2.5 py-1 text-xs">
            AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="console" className="mt-0 border-0 p-0">
          <ConsoleTabs
            submission={submission}
            aiExplanation={aiExplanation}
            aiAvailable={aiAvailable}
            aiLoading={aiLoading}
            onRequestCompileExplanation={onRequestCompileExplanation}
            embedded
          />
        </TabsContent>

        <TabsContent value="ai" className="mt-3">
          <LearningAssistantPanel
            problemId={problemId}
            language={language}
            getSourceCode={getSourceCode}
            submissionId={submission?.id ?? null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
});
