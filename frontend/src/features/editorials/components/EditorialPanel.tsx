import { useEffect, useState } from 'react';
import { BookOpen, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/features/editorials/components/MarkdownRenderer';
import type { ProblemEditorial } from '@/types/editorials';

const STORAGE_PREFIX = 'judgex.editorial.revealed:';

function storageKey(slug: string) {
  return `${STORAGE_PREFIX}${slug}`;
}

function readRevealed(slug: string): boolean {
  try {
    return localStorage.getItem(storageKey(slug)) === '1';
  } catch {
    return false;
  }
}

function writeRevealed(slug: string) {
  try {
    localStorage.setItem(storageKey(slug), '1');
  } catch {
    /* ignore */
  }
}

interface EditorialPanelProps {
  editorial: ProblemEditorial;
  problemSlug: string;
  /** Called when the user cancels the reveal gate (e.g. switch to Description). */
  onCancelReveal?: () => void;
}

export function EditorialPanel({
  editorial,
  problemSlug,
  onCancelReveal,
}: EditorialPanelProps) {
  const [revealed, setRevealed] = useState(() => readRevealed(problemSlug));
  const updated = new Date(editorial.updatedAt);

  useEffect(() => {
    setRevealed(readRevealed(problemSlug));
  }, [problemSlug]);

  const reveal = () => {
    writeRevealed(problemSlug);
    setRevealed(true);
  };

  if (!revealed) {
    return (
      <div
        className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-12 text-center shadow-card animate-fade-in"
        role="dialog"
        aria-labelledby="editorial-reveal-title"
        aria-describedby="editorial-reveal-desc"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-primary">
          <EyeOff className="h-6 w-6" aria-hidden />
        </span>
        <div className="space-y-2">
          <h2
            id="editorial-reveal-title"
            className="text-lg font-semibold text-foreground"
          >
            Reveal Editorial
          </h2>
          <p id="editorial-reveal-desc" className="text-sm text-muted-foreground">
            Reading the editorial may spoil the problem.
            <br />
            Try solving the problem first.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onCancelReveal?.()}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={reveal}>
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Reveal Editorial
          </Button>
        </div>
        <p className="text-xs text-muted">
          Your choice is remembered in this browser.
        </p>
      </div>
    );
  }

  return (
    <article className="space-y-5 animate-fade-in">
      <header className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
          Editorial
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {editorial.title}
        </h2>
        <p className="text-xs text-muted">
          Updated{' '}
          {Number.isNaN(updated.getTime())
            ? editorial.updatedAt
            : updated.toLocaleString()}
        </p>
      </header>
      <MarkdownRenderer markdown={editorial.markdown} />
    </article>
  );
}
