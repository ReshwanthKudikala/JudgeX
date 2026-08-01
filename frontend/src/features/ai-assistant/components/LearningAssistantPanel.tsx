import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Copy,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/features/editorials';
import {
  COMPILE_ERROR_ACTION,
  getFollowUpActions,
  getVisibleCoachActions,
  loadingLabelForAction,
  type CoachQuickAction,
} from '@/features/ai-assistant/coach-actions';
import {
  getCoachFeedback,
  setCoachFeedback,
  type CoachFeedbackValue,
} from '@/features/ai-assistant/coach-feedback';
import { useLearningAssistant } from '@/features/ai-assistant/hooks/useLearningAssistant';
import { useToast } from '@/hooks/useToast';
import type {
  CoachAction,
  CoachLastRunResult,
  CoachLastSubmission,
} from '@/types/ai-assistant';
import {
  canRequestHint,
  showRevealEditorial,
} from '@/features/ai-assistant/hint-progress';
import { cn } from '@/utils/cn';

export interface CoachPendingIntent {
  action: CoachAction;
  label: string;
  message: string;
  /** Bumps to re-trigger the same action. */
  nonce: number;
}

interface LearningAssistantPanelProps {
  problemId: string;
  language: 'python' | 'cpp';
  getSourceCode: () => string;
  submissionId?: string | null;
  getLastRunResult?: () => CoachLastRunResult | null | undefined;
  getLastSubmission?: () => CoachLastSubmission | null | undefined;
  /** External intent (e.g. Result tab → Explain Compile Error). */
  pendingIntent?: CoachPendingIntent | null;
  onPendingIntentConsumed?: () => void;
  className?: string;
}

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

const COACH_MD_CLASS =
  'coach-markdown text-xs text-foreground ' +
  '[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:border-b [&_h1]:border-border/60 [&_h1]:pb-1 [&_h1]:text-sm [&_h1]:font-semibold ' +
  '[&_h2]:mb-1.5 [&_h2]:mt-2.5 [&_h2]:text-xs [&_h2]:font-semibold ' +
  '[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-medium ' +
  '[&_p]:my-1.5 [&_p]:leading-relaxed ' +
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 ' +
  '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 ' +
  '[&_li]:my-0.5 ' +
  '[&_blockquote]:my-2 [&_blockquote]:rounded-r [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:bg-overlay/60 [&_blockquote]:py-1.5 [&_blockquote]:pl-3 [&_blockquote]:italic ' +
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[11px] ' +
  '[&_th]:border [&_th]:border-border [&_th]:bg-overlay/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold ' +
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 ' +
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/70 [&_pre]:bg-editor [&_pre]:p-2 ' +
  '[&_code]:rounded [&_code]:bg-editor [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] ' +
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_hr]:my-3 [&_hr]:border-border/70';

export const LearningAssistantPanel = memo(function LearningAssistantPanel({
  problemId,
  language,
  getSourceCode,
  submissionId,
  getLastRunResult,
  getLastSubmission,
  pendingIntent = null,
  onPendingIntentConsumed,
  className,
}: LearningAssistantPanelProps) {
  const { toast, error: errorToast } = useToast();
  const [draft, setDraft] = useState('');
  const [feedbackMap, setFeedbackMap] = useState<Record<string, CoachFeedbackValue>>(
    {},
  );
  const transcriptRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    clear,
    ask,
    regenerate,
    lastRequest,
    revealEditorialPrompt,
    hintUnlockedThrough,
    activeAction,
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
    async (opts: CoachQuickAction & { hintLevel?: 1 | 2 | 3 }) => {
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
    [ask],
  );

  // External intent from Result tab / compile error CTA.
  useEffect(() => {
    if (!pendingIntent) return;
    void runAction(pendingIntent).finally(() => {
      onPendingIntentConsumed?.();
    });
  }, [pendingIntent, runAction, onPendingIntentConsumed]);

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

  const copyMessage = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        toast({ title: 'Copied response', variant: 'default' });
      } catch {
        errorToast('Copy failed', 'Clipboard permission denied.');
      }
    },
    [toast, errorToast],
  );

  const handleFeedback = useCallback((messageId: string, value: CoachFeedbackValue) => {
    setCoachFeedback(messageId, value);
    setFeedbackMap((prev) => ({ ...prev, [messageId]: value }));
  }, []);

  const handleRegenerate = useCallback(async () => {
    try {
      await regenerate();
    } catch {
      /* already in transcript */
    }
  }, [regenerate]);

  const nextHintLevel = (hintUnlockedThrough + 1) as 1 | 2 | 3 | 4;
  const revealUnlocked = showRevealEditorial(hintUnlockedThrough);
  const run = getLastRunResult?.() ?? null;
  const sub = getLastSubmission?.() ?? null;
  const visibleActions = getVisibleCoachActions(run, sub);

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const followUps =
    !isLoading && lastAssistant?.action
      ? getFollowUpActions(lastAssistant.action)
      : [];

  const nextAvailableHint = Math.min(nextHintLevel, 3) as 1 | 2 | 3;
  const canAskNextHint =
    hintUnlockedThrough < 3 &&
    canRequestHint(hintUnlockedThrough, nextAvailableHint);

  return (
    <div
      className={cn('flex min-h-0 flex-col gap-2', className)}
      aria-label="AI Coach"
    >
      <div className="flex flex-wrap gap-1">
        {visibleActions.map((item) => (
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
        {canAskNextHint || hintUnlockedThrough < 3 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={isLoading || !canAskNextHint}
            title={
              hintUnlockedThrough >= 3
                ? 'All hints received — open Reveal Editorial below'
                : `Request Hint ${nextAvailableHint}`
            }
            onClick={() => {
              const hint = HINT_LEVELS.find((h) => h.level === nextAvailableHint);
              if (!hint || !canAskNextHint) return;
              void runAction({
                action: 'HINT',
                label: hint.label,
                message: hint.message,
                hintLevel: hint.level,
              });
            }}
          >
            Need a Hint
          </Button>
        ) : null}
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
            AI Coach uses only public problem context and your code. Hidden judge
            tests are never sent.
          </p>
        ) : (
          messages.map((msg, index) => {
            const isLastAssistant =
              msg.role === 'assistant' && index === messages.length - 1;
            const feedback =
              feedbackMap[msg.id] ?? getCoachFeedback(msg.id) ?? null;

            return (
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
                  <>
                    <MarkdownRenderer
                      markdown={msg.content}
                      className={COACH_MD_CLASS}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border/40 pt-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-1.5 text-[10px]"
                        onClick={() => void copyMessage(msg.content)}
                        title="Copy response"
                      >
                        <Copy className="h-3 w-3" aria-hidden />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-6 gap-1 px-1.5 text-[10px]',
                          feedback === 'helpful' && 'text-primary',
                        )}
                        onClick={() => handleFeedback(msg.id, 'helpful')}
                        title="Helpful"
                      >
                        <ThumbsUp className="h-3 w-3" aria-hidden />
                        Helpful
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-6 gap-1 px-1.5 text-[10px]',
                          feedback === 'not_helpful' && 'text-primary',
                        )}
                        onClick={() => handleFeedback(msg.id, 'not_helpful')}
                        title="Not helpful"
                      >
                        <ThumbsDown className="h-3 w-3" aria-hidden />
                        Not Helpful
                      </Button>
                      {isLastAssistant && lastRequest ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-1.5 text-[10px]"
                          disabled={isLoading}
                          onClick={() => void handleRegenerate()}
                          title="Regenerate"
                        >
                          <RefreshCw className="h-3 w-3" aria-hidden />
                          Regenerate
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            );
          })
        )}

        {isLoading ? (
          <div
            className="flex items-center gap-2 rounded-md border border-border/60 bg-surface px-2.5 py-3 text-xs text-muted"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
            <span>
              {loadingLabelForAction(
                activeAction ?? lastRequest?.action,
                lastRequest?.hintLevel,
                lastRequest?.label,
              )}
            </span>
          </div>
        ) : null}

        {followUps.length > 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-overlay/30 px-2.5 py-2">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              What would you like to do next?
            </p>
            <div className="flex flex-wrap gap-1">
              {followUps.map((item) => (
                <Button
                  key={`follow-${item.label}`}
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
              {canAskNextHint ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  disabled={isLoading}
                  onClick={() => {
                    const hint = HINT_LEVELS.find((h) => h.level === nextAvailableHint);
                    if (!hint) return;
                    void runAction({
                      action: 'HINT',
                      label: hint.label,
                      message: hint.message,
                      hintLevel: hint.level,
                    });
                  }}
                >
                  Need a Hint
                </Button>
              ) : null}
            </div>
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
          disabled={messages.length === 0 || isLoading}
          onClick={clear}
        >
          Clear conversation
        </Button>
      </div>
    </div>
  );
});

export { COMPILE_ERROR_ACTION };
