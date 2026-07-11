import { useCallback, useEffect, useRef, useState } from 'react';

import { loadDraft, saveDraft } from '@/features/editor/persistence';
import { getTemplate } from '@/features/editor/templates';
import {
  EMPTY_CONSOLE,
  type ConsoleState,
  type EditorLanguage,
} from '@/features/editor/types';

const DEFAULT_LANGUAGE: EditorLanguage = 'python';
const LANGUAGE_PREF_KEY = 'judgex.editor.language';

function loadLanguagePreference(): EditorLanguage {
  try {
    const raw = localStorage.getItem(LANGUAGE_PREF_KEY);
    if (raw === 'cpp' || raw === 'python') return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

function resolveInitialCode(slug: string, language: EditorLanguage): string {
  const saved = loadDraft(slug, language);
  return saved ?? getTemplate(language);
}

export interface UseEditorOptions {
  problemSlug: string;
  /** Called when Ctrl+S is pressed (Run placeholder). */
  onRunPlaceholder?: () => void;
  /** Called when Ctrl+Enter is pressed (Submit placeholder). */
  onSubmitPlaceholder?: () => void;
}

/**
 * Local editor state (not Zustand).
 * Owns language, code, draft persistence, templates, and keyboard shortcuts.
 * No API calls — Sprint 24 wires Run/Submit here.
 */
export function useEditor({
  problemSlug,
  onRunPlaceholder,
  onSubmitPlaceholder,
}: UseEditorOptions) {
  const [language, setLanguageState] = useState<EditorLanguage>(loadLanguagePreference);
  const [code, setCodeState] = useState(() =>
    resolveInitialCode(problemSlug, loadLanguagePreference()),
  );
  const [consoleState] = useState<ConsoleState>(EMPTY_CONSOLE);
  const [isDirty, setIsDirty] = useState(false);

  const languageRef = useRef(language);
  const codeRef = useRef(code);
  const slugRef = useRef(problemSlug);
  const runRef = useRef(onRunPlaceholder);
  const submitRef = useRef(onSubmitPlaceholder);

  languageRef.current = language;
  codeRef.current = code;
  slugRef.current = problemSlug;
  runRef.current = onRunPlaceholder;
  submitRef.current = onSubmitPlaceholder;

  // Persist current draft whenever code changes (debounced lightly via rAF batching is optional;
  // synchronous write is fine for coding drafts).
  const setCode = useCallback((next: string) => {
    setCodeState(next);
    codeRef.current = next;
    setIsDirty(true);
    saveDraft(slugRef.current, languageRef.current, next);
  }, []);

  const setLanguage = useCallback((next: EditorLanguage) => {
    const prev = languageRef.current;
    if (next === prev) return;

    // Persist outgoing language draft before switching.
    saveDraft(slugRef.current, prev, codeRef.current);

    const incoming = resolveInitialCode(slugRef.current, next);
    languageRef.current = next;
    codeRef.current = incoming;
    setLanguageState(next);
    setCodeState(incoming);
    setIsDirty(false);

    try {
      localStorage.setItem(LANGUAGE_PREF_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  // When navigating to another problem, reload drafts for the active language.
  useEffect(() => {
    const nextCode = resolveInitialCode(problemSlug, languageRef.current);
    slugRef.current = problemSlug;
    codeRef.current = nextCode;
    setCodeState(nextCode);
    setIsDirty(false);
  }, [problemSlug]);

  // Keyboard shortcuts: Ctrl/Cmd+S → Run placeholder; Ctrl/Cmd+Enter → Submit placeholder.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;

      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        runRef.current?.();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        submitRef.current?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const resetToTemplate = useCallback(() => {
    const template = getTemplate(languageRef.current);
    setCode(template);
  }, [setCode]);

  return {
    language,
    code,
    setCode,
    setLanguage,
    consoleState,
    isDirty,
    resetToTemplate,
    /** Sprint 24: replace these no-ops with real run/submit handlers. */
    run: onRunPlaceholder,
    submit: onSubmitPlaceholder,
  };
}
