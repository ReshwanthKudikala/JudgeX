export type EditorLanguage = 'cpp' | 'python';

export const EDITOR_LANGUAGES: Array<{
  value: EditorLanguage;
  label: string;
  monacoId: string;
}> = [
  { value: 'python', label: 'Python 3', monacoId: 'python' },
  { value: 'cpp', label: 'C++17', monacoId: 'cpp' },
];

export function monacoLanguageId(language: EditorLanguage): string {
  return EDITOR_LANGUAGES.find((l) => l.value === language)?.monacoId ?? 'plaintext';
}

/** Console placeholders — Sprint 24 will fill these from run/submit results. */
export interface ConsoleState {
  output: string;
  error: string;
  executionTimeMs: number | null;
  memoryKb: number | null;
}

export const EMPTY_CONSOLE: ConsoleState = {
  output: '',
  error: '',
  executionTimeMs: null,
  memoryKb: null,
};
