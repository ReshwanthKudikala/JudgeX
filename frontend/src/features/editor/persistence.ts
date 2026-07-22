import type { EditorLanguage } from '@/features/editor/types';

const STORAGE_PREFIX = 'judgex.editor.draft';

/** Persistence key: `{slug}_{language}` e.g. `two-sum_cpp`. */
export function draftStorageKey(problemSlug: string, language: EditorLanguage): string {
  return `${STORAGE_PREFIX}.${problemSlug}_${language}`;
}

export function loadDraft(problemSlug: string, language: EditorLanguage): string | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(problemSlug, language));
    return raw === null ? null : raw;
  } catch {
    return null;
  }
}

export function saveDraft(
  problemSlug: string,
  language: EditorLanguage,
  code: string,
): void {
  try {
    localStorage.setItem(draftStorageKey(problemSlug, language), code);
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearDraft(problemSlug: string, language: EditorLanguage): void {
  try {
    localStorage.removeItem(draftStorageKey(problemSlug, language));
  } catch {
    /* ignore */
  }
}

/** Remove every problem draft. Call on logout so the next user never sees prior code. */
export function clearAllDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${STORAGE_PREFIX}.`)) keys.push(key);
    }
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
