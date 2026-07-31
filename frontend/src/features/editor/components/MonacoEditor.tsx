import { memo, useMemo } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

import { monacoLanguageId, type EditorLanguage } from '@/features/editor/types';
import { useThemeStore } from '@/store/theme.store';
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
  lineHeight: 22,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontLigatures: true,
  cursorBlinking: 'smooth' as const,
  cursorSmoothCaretAnimation: 'on' as const,
  smoothScrolling: true,
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
  padding: { top: 14, bottom: 14 },
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    useShadows: false,
  },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  fixedOverflowWidgets: true,
  renderWhitespace: 'selection' as const,
};

export const MonacoEditor = memo(function MonacoEditor({
  language,
  value,
  onChange,
  readOnly = false,
  className,
}: MonacoEditorProps) {
  const resolved = useThemeStore((s) => s.resolved);
  const monacoTheme = resolved === 'dark' ? 'vs-dark' : 'light';

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
      className={cn('h-full min-h-[240px] bg-editor', className)}
      role="textbox"
      aria-label={readOnly ? 'Source code (read-only)' : 'Code editor'}
      aria-multiline="true"
      aria-readonly={readOnly || undefined}
    >
      <Editor
        key={`${language}-${monacoTheme}`}
        height="100%"
        theme={monacoTheme}
        language={monacoLanguageId(language)}
        value={value}
        options={options}
        onMount={handleMount}
        onChange={(next) => {
          if (readOnly || !onChange) return;
          if (typeof next === 'string') onChange(next);
        }}
        loading={
          <div className="flex h-full min-h-[240px] items-center justify-center bg-editor text-sm text-muted">
            Loading editor…
          </div>
        }
      />
    </div>
  );
});
