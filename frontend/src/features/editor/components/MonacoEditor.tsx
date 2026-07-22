import { memo, useMemo } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

import { monacoLanguageId, type EditorLanguage } from '@/features/editor/types';
import { cn } from '@/utils/cn';

interface MonacoEditorProps {
  language: EditorLanguage;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
}

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontLigatures: true,
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: false,
  wordWrap: 'on' as const,
  lineNumbers: 'on' as const,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  folding: true,
  matchBrackets: 'always' as const,
  autoIndent: 'full' as const,
  renderLineHighlight: 'line' as const,
  padding: { top: 12, bottom: 12 },
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  fixedOverflowWidgets: true,
};

export const MonacoEditor = memo(function MonacoEditor({
  language,
  value,
  onChange,
  readOnly = false,
  className,
}: MonacoEditorProps) {
  const options = useMemo(
    () => ({
      ...EDITOR_OPTIONS,
      readOnly,
      domReadOnly: readOnly,
    }),
    [readOnly],
  );

  const handleMount: OnMount = (editor) => {
    if (!readOnly) editor.focus();
  };

  return (
    <div
      data-editor-slot="monaco"
      className={cn('h-full min-h-[240px] bg-[#0c0e12]', className)}
      role="textbox"
      aria-label={readOnly ? 'Source code (read-only)' : 'Code editor'}
      aria-multiline="true"
      aria-readonly={readOnly || undefined}
    >
      <Editor
        key={language}
        height="100%"
        theme="vs-dark"
        language={monacoLanguageId(language)}
        value={value}
        options={options}
        onMount={handleMount}
        onChange={(next) => {
          if (readOnly || !onChange) return;
          if (typeof next === 'string') onChange(next);
        }}
        loading={
          <div className="flex h-full min-h-[240px] items-center justify-center bg-[#0c0e12] text-sm text-muted">
            Loading editor…
          </div>
        }
      />
    </div>
  );
});
