import { memo, useCallback, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/features/editorials';
import { useLearningAssistant } from '@/features/ai-assistant/hooks/useLearningAssistant';
import { useToast } from '@/hooks/useToast';
import type { AiAssistAction } from '@/types/ai-assistant';
import { cn } from '@/utils/cn';

interface LearningAssistantPanelProps {
  problemId: string;
  language: 'python' | 'cpp';
  getSourceCode: () => string;
  submissionId?: string | null;
  className?: string;
}

const QUICK_ACTIONS: Array<{
  label: string;
  action: AiAssistAction;
  hintLevel?: 1 | 2 | 3 | 4;
  needsSubmission?: boolean;
  revealSolution?: boolean;
}> = [
  { label: 'Explain my code', action: 'explain_code' },
  { label: 'Why did my submission fail?', action: 'why_failed', needsSubmission: true },
  { label: 'How can I optimize this?', action: 'optimize' },
  { label: 'Complexity analysis', action: 'complexity' },
  { label: 'Hint 1 — Direction', action: 'hint', hintLevel: 1 },
  { label: 'Hint 2 — Algorithm', action: 'hint', hintLevel: 2 },
  { label: 'Hint 3 — Data structure', action: 'hint', hintLevel: 3 },
  { label: 'Hint 4 — Almost there', action: 'hint', hintLevel: 4 },
];

export const LearningAssistantPanel = memo(function LearningAssistantPanel({
  problemId,
  language,
  getSourceCode,
  submissionId,
  className,
}: LearningAssistantPanelProps) {
  const { toast, error: errorToast } = useToast();
  const [draft, setDraft] = useState('');
  const { messages, clear, ask, isLoading } = useLearningAssistant({
    problemId,
    language,
    getSourceCode,
    submissionId,
  });

  const runAction = useCallback(
    async (opts: {
      action: AiAssistAction;
      label: string;
      message?: string;
      hintLevel?: 1 | 2 | 3 | 4;
      needsSubmission?: boolean;
      revealSolution?: boolean;
    }) => {
      if (opts.needsSubmission && !submissionId) {
        errorToast('No submission yet', 'Submit code first, then ask why it failed.');
        return;
      }
      try {
        await ask(opts);
      } catch {
        /* message already appended */
      }
    },
    [ask, submissionId, errorToast],
  );

  const handleAsk = useCallback(async () => {
    const message = draft.trim();
    if (!message) return;
    setDraft('');
    const wantsSolution = /\b(full solution|complete solution|give me the solution)\b/i.test(
      message,
    );
    try {
      await ask({
        action: wantsSolution ? 'reveal_solution' : 'ask',
        message,
        label: message,
        revealSolution: wantsSolution,
      });
    } catch {
      /* surfaced in transcript */
    }
  }, [ask, draft]);

  const copyLast = useCallback(async () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) {
      toast({ title: 'Nothing to copy', variant: 'default' });
      return;
    }
    try {
      await navigator.clipboard.writeText(last.content);
      toast({ title: 'Copied AI response', variant: 'default' });
    } catch {
      errorToast('Copy failed', 'Clipboard permission denied.');
    }
  }, [messages, toast, errorToast]);

  return (
    <div
      className={cn('flex min-h-[220px] flex-col gap-3', className)}
      aria-label="AI learning assistant"
    >
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((item) => (
          <Button
            key={item.label}
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={isLoading}
            onClick={() => void runAction(item)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="max-h-56 flex-1 space-y-3 overflow-y-auto rounded-md border border-border bg-[#0c0e12]/p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-muted">
            Ask for hints, complexity, or help diagnosing a failed submission. AI is only
            called when you request it. Full solutions are withheld unless you explicitly ask.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'rounded-md px-2.5 py-2 text-xs',
                msg.role === 'user'
                  ? 'bg-primary/10 text-foreground'
                  : 'bg-muted/10 text-muted-foreground',
              )}
            >
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
                {msg.role === 'user' ? 'You' : 'AI'}
                {msg.wasBlocked ? ' · guarded' : ''}
                {msg.hintLevel ? ` · hint ${msg.hintLevel}` : ''}
              </p>
              {msg.role === 'assistant' ? (
                <MarkdownRenderer markdown={msg.content} className="text-xs [&_p]:my-1.5" />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {(msg.timeComplexity || msg.spaceComplexity) && (
                <p className="mt-2 text-[11px] text-muted">
                  {msg.timeComplexity ? `Time: ${msg.timeComplexity}` : null}
                  {msg.timeComplexity && msg.spaceComplexity ? ' · ' : null}
                  {msg.spaceComplexity ? `Space: ${msg.spaceComplexity}` : null}
                </p>
              )}
            </div>
          ))
        )}
        {isLoading ? (
          <p className="text-xs text-muted animate-pulse">Thinking…</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleAsk();
            }
          }}
          placeholder="Ask AI…"
          disabled={isLoading}
          className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={isLoading || !draft.trim()}
          onClick={() => void handleAsk()}
        >
          Ask AI
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          disabled={messages.length === 0}
          onClick={() => void copyLast()}
        >
          Copy AI response
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          disabled={messages.length === 0 || isLoading}
          onClick={clear}
        >
          Clear conversation
        </Button>
      </div>
    </div>
  );
});
