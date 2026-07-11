import { memo } from 'react';

import { EDITOR_LANGUAGES, type EditorLanguage } from '@/features/editor/types';

interface EditorStatusProps {
  language: EditorLanguage;
  isDirty?: boolean;
}

export const EditorStatus = memo(function EditorStatus({
  language,
  isDirty = false,
}: EditorStatusProps) {
  const label =
    EDITOR_LANGUAGES.find((l) => l.value === language)?.label ?? language;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted" aria-live="polite">
      <span className="truncate">{label}</span>
      <span className="text-muted/50" aria-hidden>
        ·
      </span>
      <span>{isDirty ? 'Draft saved locally' : 'Ready'}</span>
      <span className="ml-auto hidden text-[11px] text-muted/70 sm:inline">
        Ctrl+S Run · Ctrl+Enter Submit
      </span>
    </div>
  );
});
