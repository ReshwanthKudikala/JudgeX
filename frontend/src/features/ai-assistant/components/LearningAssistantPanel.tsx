import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/features/editorials';
import { useLearningAssistant } from '@/features/ai-assistant/hooks/useLearningAssistant';
import { useToast } from '@/hooks/useToast';
import type {
  CoachAction,
  CoachLastRunResult,
  CoachLastSubmission,
} from '@/types/ai-assistant';
import {
  canRequestHint,
  afterSuccessfulHint,
  showRevealEditorial,
} from '@/features/ai-assistant/hint-progress';
import { cn } from '@/utils/cn';

interface LearningAssistantPanelProps {
  problemId: string;
  language: 'python' | 'cpp';
  getSourceCode: () => string;
  submissionId?: string | null;
  getLastRunResult?: () => CoachLastRunResult | null | undefined;
  getLastSubmission?: () => CoachLastSubmission | null | undefined;
  className?: string;
}

const QUICK_ACTIONS: Array<{
  label: string;
  action: CoachAction;
  message: string;
  needsSubmission?: boolean;
  needsRunOrSubmission?: boolean;
}> = [
  {
    label: 'Explain My Code',
    action: 'EXPLAIN_CODE',
    message: 'Explain my current code in the context of this problem.',
  },
  {
    label: 'Review My Solution',
    action: 'REVIEW',
    message: 'Review my solution like an experienced technical interviewer.',
  },
  {
    label: 'Why wrong answer?',
    action: 'WRONG_ANSWER',
    message: 'Help me understand why my latest run or submission failed.',
    needsRunOrSubmission: true,
  },
  {
    label: 'Compile error help',
    action: 'COMPILE_ERROR',
    message: 'Help me understand the compile or interpreter error.',
  },
  {
    label: 'How can I optimize?',
    action: 'OPTIMIZE',
    message: 'How can I optimize this approach?',
  },
  {
    label: 'Complexity analysis',
    action: 'COMPLEXITY',
    message: 'Analyze the time and space complexity of my code.',
  },
];

const HINT_LEVELS: Array<{
  level: 1 | 2 | 3;
  label: string;
  message: string;
}> = [
  {
    level: 1,
    label: 'Hint 1',
    message: 'Give me a subtle Hint 1 — guide my thinking without naming an algorithm.',
  },
  {
    level: 2,
    label: 'Hint 2',
    message:
      'Give me Hint 2 — a more concrete nudge toward a data structure or technique, still without code.',
  },
  {
    level: 3,
    label: 'Hint 3',
    message:
      'Give me Hint 3 — explain the approach clearly in words, but do not generate code.',
  },
];

export const LearningAssistantPanel = memo(function LearningAssistantPanel({
  problemId,
  language,
  getSourceCode,
  submissionId,
  getLastRunResult,
  getLastSubmission,
  className,
}: LearningAssistantPanelProps) {
  const { toast, error: errorToast } = useToast();
  const [draft, setDraft] = useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    clear,
    ask,
    revealEditorialPrompt,
    hintUnlockedThrough,
    isLoading,
  } = useLearningAssistant({
    problemId,
    language,
    getSourceCode,
    submissionId,
    getLastRunResult,
    getLastSubmission,
  });

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const runAction = useCallback(
    async (opts: {
      action: CoachAction;
      label: string;
      message: string;
      needsSubmission?: boolean;
      needsRunOrSubmission?: boolean;
      hintLevel?: 1 | 2 | 3;
    }) => {
      if (opts.needsSubmission && !submissionId) {
        errorToast('No submission yet', 'Submit code first, then ask why it failed.');
        return;
      }
      if (opts.needsRunOrSubmission) {
        const run = getLastRunResult?.();
        const sub = getLastSubmission?.();
        if (!run && !sub) {
          errorToast('No result yet', 'Run or submit code first, then ask about the failure.');
          return;
        }
      }
      try {
        await ask({
          action: opts.action,
          message: opts.message,
          label: opts.label,
          hintLevel: opts.hintLevel,
        });
      } catch {
        /* message already appended */
      }
    },
    [ask, submissionId, errorToast, getLastRunResult, getLastSubmission],
  );

  const handleAsk = useCallback(async () => {
    const message = draft.trim();
    if (!message) return;
    setDraft('');
    try {
      await ask({
        action: 'UNKNOWN',
        message,
        label: message,
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

  const nextHintLevel = (hintUnlockedThrough + 1) as 1 | 2 | 3 | 4;
  const revealUnlocked = showRevealEditorial(hintUnlockedThrough);

  return (
    <div
      className={cn('flex min-h-0 flex-col gap-2', className)}
      aria-label="AI learning coach"
    >
      <div className="flex flex-wrap gap-1">
        {QUICK_ACTIONS.map((item) => (
          <Button
            key={item.label}
            type="button"
            variant="secondary"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={isLoading}
            onClick={() => void runAction(item)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div
        className="flex flex-col gap-1 rounded-md border border-border/50 bg-overlay/40 px-2 py-1.5"
        aria-label="Progressive hints"
      >
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
          Progressive hints
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {HINT_LEVELS.map((hint, index) => {
            const unlocked = canRequestHint(hintUnlockedThrough, hint.level);
            const alreadyDone = hintUnlockedThrough >= hint.level;
            const isNext = nextHintLevel === hint.level;
            return (
              <div key={hint.level} className="flex items-center gap-1">
                {index > 0 ? (
                  <ChevronDown
                    className="h-3 w-3 shrink-0 rotate-[-90deg] text-muted/70"
                    aria-hidden
                  />
                ) : null}
                <Button
                  type="button"
                  variant={isNext ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-6 px-1.5 text-[10px]',
                    alreadyDone && 'text-primary',
                  )}
                  disabled={isLoading || !unlocked || alreadyDone}
                  title={
                    !unlocked
                      ? `Receive Hint ${hint.level - 1} first`
                      : alreadyDone
                        ? `Hint ${hint.level} already received`
                        : `Request Hint ${hint.level}`
                  }
                  onClick={() =>
                    void runAction({
                      action: 'HINT',
                      label: hint.label,
                      message: hint.message,
                      hintLevel: hint.level,
                    })
                  }
                >
                  {hint.label}
                  {alreadyDone ? ' ✓' : null}
                </Button>
              </div>
            );
          })}
          {revealUnlocked ? (
            <>
              <ChevronDown
                className="h-3 w-3 shrink-0 rotate-[-90deg] text-muted/70"
                aria-hidden
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                disabled={isLoading}
                onClick={revealEditorialPrompt}
              >
                Reveal Editorial
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div
        ref={transcriptRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto scroll-smooth"
      >
        {messages.length === 0 && !isLoading ? (
          <p className="text-xs text-muted">
            Use progressive hints to discover the approach yourself — never a full
            solution. Hidden judge tests are never sent.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'rounded-md px-2.5 py-2 text-xs',
                msg.role === 'user'
                  ? 'bg-primary/10 text-foreground'
                  : 'border border-border/60 bg-surface text-muted-foreground',
              )}
            >
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
                {msg.role === 'user' ? 'You' : 'Coach'}
                {msg.hintLevel ? ` · hint ${msg.hintLevel}` : ''}
              </p>
              {msg.role === 'assistant' ? (
                <MarkdownRenderer
                  markdown={msg.content}
                  className="text-xs text-foreground [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mb-1.5 [&_h2]:mt-2.5 [&_h2]:text-xs [&_h2]:font-semibold [&_li]:my-0.5 [&_p]:my-1.5 [&_pre]:my-2 [&_table]:my-2"
                />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          ))
        )}

        {isLoading ? (
          <div
            className="flex items-center gap-2 rounded-md border border-border/60 bg-surface px-2.5 py-3 text-xs text-muted"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
            <span>
              {(() => {
                const last = [...messages].reverse().find((m) => m.role === 'user')
                  ?.content;
                if (last?.startsWith('Hint')) return `Preparing ${last}…`;
                if (last === 'Review My Solution') return 'Reviewing your solution…';
                if (last === 'Explain My Code') return 'Explaining your code…';
                return 'Thinking…';
              })()}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2">
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
          placeholder="Ask the coach…"
          disabled={isLoading}
          className="h-7 min-w-0 flex-1 rounded border border-border/70 bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        />
        <Button
          type="button"
          size="sm"
          className="h-7 shrink-0"
          disabled={isLoading || !draft.trim()}
          onClick={() => void handleAsk()}
        >
          Ask
        </Button>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px]"
          disabled={messages.length === 0}
          onClick={() => void copyLast()}
        >
          Copy AI response
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px]"
          disabled={messages.length === 0 || isLoading}
          onClick={clear}
        >
          Clear conversation
        </Button>
      </div>
    </div>
  );
});
