import { memo } from 'react';
import { Play, Send } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/utils/cn';

interface EditorPlaceholderProps {
  className?: string;
}

/**
 * Reserves the full right-hand editor chrome for a future Monaco sprint.
 * Layout slots (toolbar / editor / actions / console) must stay stable so
 * Monaco can drop into the editor card without redesigning the page.
 */
export const EditorPlaceholder = memo(function EditorPlaceholder({
  className,
}: EditorPlaceholderProps) {
  return (
    <div
      className={cn('flex h-full min-h-[420px] flex-col rounded-lg border border-border bg-card', className)}
      aria-label="Code editor (coming soon)"
    >
      {/* Language toolbar — same row Monaco will sit under */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <label htmlFor="editor-language" className="sr-only">
          Language
        </label>
        <Select
          id="editor-language"
          disabled
          className="h-8 w-36 text-xs"
          aria-label="Language selector (disabled until editor is ready)"
          defaultValue="python"
        >
          <option value="python">Python 3</option>
          <option value="cpp">C++17</option>
        </Select>
        <span className="text-xs text-muted">Editor coming soon</span>
      </div>

      {/* Editor surface — Monaco mounts here next sprint */}
      <div
        data-editor-slot="monaco"
        className="relative flex min-h-[240px] flex-1 flex-col items-center justify-center bg-[#0c0e12] px-4"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden>
          <pre className="p-4 font-mono text-xs leading-5 text-white">
            {`def solve():\n    # Your solution here\n    pass\n`}
          </pre>
        </div>
        <p className="relative z-10 text-sm font-medium text-muted-foreground">
          Code editor placeholder
        </p>
        <p className="relative z-10 mt-1 max-w-xs text-center text-xs text-muted">
          Monaco will plug into this panel next sprint without changing the surrounding layout.
        </p>
      </div>

      {/* Run / Submit — disabled stubs matching future UX */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-2">
        <Button type="button" variant="secondary" size="sm" disabled aria-disabled>
          <Play className="h-3.5 w-3.5" aria-hidden />
          Run
        </Button>
        <Button type="button" size="sm" disabled aria-disabled>
          <Send className="h-3.5 w-3.5" aria-hidden />
          Submit
        </Button>
      </div>

      {/* Console / output pane */}
      <div
        className="border-t border-border bg-[#0c0e12] px-3 py-2"
        aria-label="Console output placeholder"
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Console</p>
        <p className="mt-1 font-mono text-xs text-muted/80">
          Run output will appear here…
        </p>
      </div>
    </div>
  );
});
