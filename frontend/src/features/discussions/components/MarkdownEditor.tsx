import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { MarkdownRenderer } from '@/features/editorials';
import { cn } from '@/utils/cn';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
}

/**
 * Lightweight markdown composer with write/preview toggle.
 * Reuses MarkdownRenderer — no duplicate markdown stack.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write in Markdown…',
  rows = 8,
  disabled,
  className,
  label,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        {label ? <p className="text-xs font-medium text-muted">{label}</p> : <span />}
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === 'write' ? 'primary' : 'ghost'}
            className="h-7 px-2 text-[11px]"
            onClick={() => setMode('write')}
          >
            Write
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'preview' ? 'primary' : 'ghost'}
            className="h-7 px-2 text-[11px]"
            onClick={() => setMode('preview')}
          >
            Preview
          </Button>
        </div>
      </div>
      {mode === 'write' ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
        />
      ) : !value.trim() ? (
        <div className="min-h-[96px] rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted">
          Nothing to preview.
        </div>
      ) : (
        <div className="min-h-[96px] rounded-md border border-border bg-[#0c0e12] px-3 py-2">
          <MarkdownRenderer markdown={value} />
        </div>
      )}
    </div>
  );
}

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagInput({ value, onChange, disabled }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const tag = draft.trim().toLowerCase();
    if (!tag || value.includes(tag) || value.length >= 8) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">Tags</p>
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <button
            key={tag}
            type="button"
            disabled={disabled}
            className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-error/40 hover:text-error"
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            {tag} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          disabled={disabled || value.length >= 8}
          placeholder="Add tag"
          className="h-8"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
