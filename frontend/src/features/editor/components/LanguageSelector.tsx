import { memo } from 'react';

import { Select } from '@/components/ui/Select';
import { EDITOR_LANGUAGES, type EditorLanguage } from '@/features/editor/types';

interface LanguageSelectorProps {
  value: EditorLanguage;
  onChange: (language: EditorLanguage) => void;
  disabled?: boolean;
  id?: string;
}

export const LanguageSelector = memo(function LanguageSelector({
  value,
  onChange,
  disabled = false,
  id = 'editor-language',
}: LanguageSelectorProps) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Programming language
      </label>
      <Select
        id={id}
        value={value}
        disabled={disabled}
        className="h-8 w-36 text-xs"
        aria-label="Programming language"
        onChange={(e) => onChange(e.target.value as EditorLanguage)}
      >
        {EDITOR_LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </Select>
    </>
  );
});
