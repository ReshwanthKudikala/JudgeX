import { memo } from 'react';

import { LanguageSelector } from '@/features/editor/components/LanguageSelector';
import { EditorStatus } from '@/features/editor/components/EditorStatus';
import type { EditorLanguage } from '@/features/editor/types';

interface EditorToolbarProps {
  language: EditorLanguage;
  onLanguageChange: (language: EditorLanguage) => void;
  isDirty?: boolean;
}

export const EditorToolbar = memo(function EditorToolbar({
  language,
  onLanguageChange,
  isDirty = false,
}: EditorToolbarProps) {
  return (
    <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/95 px-3 py-1.5 backdrop-blur-sm">
      <LanguageSelector value={language} onChange={onLanguageChange} />
      <EditorStatus language={language} isDirty={isDirty} />
    </div>
  );
});
