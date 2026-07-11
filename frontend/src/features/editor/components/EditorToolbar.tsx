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
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
      <LanguageSelector value={language} onChange={onLanguageChange} />
      <EditorStatus language={language} isDirty={isDirty} />
    </div>
  );
});
