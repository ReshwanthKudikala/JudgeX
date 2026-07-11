import { useCallback, useEffect, useRef, useState } from 'react';

import { loadDraft, saveDraft } from '@/features/editor/persistence';
import { getTemplate } from '@/features/editor/templates';
import type { EditorLanguage } from '@/features/editor/types';

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
  /** Ctrl/Cmd+S — Run placeholder. */
  onRun?: () => void;
  /** Ctrl/Cmd+Enter — Submit (Sprint 24). */
  onSubmit?: () => void;
  /** When true, keyboard submit is ignored. */
  submitDisabled?: boolean;
}

/**
 * Local editor state (not Zustand).
 * Owns language, code, draft persistence, templates, and keyboard shortcuts.
 */
export function useEditor({
  problemSlug,
  onRun,
  onSubmit,
  submitDisabled = false,
}: UseEditorOptions) {
  const [language, setLanguageState] = useState<EditorLanguage>(loadLanguagePreference);
  const [code, setCodeState] = useState(() =>
    resolveInitialCode(problemSlug, loadLanguagePreference()),
  );
  const [isDirty, setIsDirty] = useState(false);

  const languageRef = useRef(language);
  const codeRef = useRef(code);
  const slugRef = useRef(problemSlug);
  const runRef = useRef(onRun);
  const submitRef = useRef(onSubmit);
  const submitDisabledRef = useRef(submitDisabled);

  languageRef.current = language;
  codeRef.current = code;
  slugRef.current = problemSlug;
  runRef.current = onRun;
  submitRef.current = onSubmit;
  submitDisabledRef.current = submitDisabled;

  const setCode = useCallback((next: string) => {
    setCodeState(next);
    codeRef.current = next;
    setIsDirty(true);
    saveDraft(slugRef.current, languageRef.current, next);
  }, []);

  const setLanguage = useCallback((next: EditorLanguage) => {
    const prev = languageRef.current;
    if (next === prev) return;

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

  useEffect(() => {
    const nextCode = resolveInitialCode(problemSlug, languageRef.current);
    slugRef.current = problemSlug;
    codeRef.current = nextCode;
    setCodeState(nextCode);
    setIsDirty(false);
  }, [problemSlug]);

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
        if (submitDisabledRef.current) return;
        submitRef.current?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    language,
    code,
    setCode,
    setLanguage,
    isDirty,
  };
}
