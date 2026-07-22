import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { EditorLanguage } from '@/features/editor/types';

/** POST /code/run request body. */
export interface CodeRunInput {
  problemId: string;
  language: EditorLanguage;
  sourceCode: string;
  /** When omitted, the API uses the first public sample. */
  customInput?: string;
}

/** POST /code/run success payload (matches backend CodeService). */
export interface CodeRunResult {
  status: 'ok' | 'compile_error' | 'runtime_error' | 'time_limit' | string;
  compile: {
    success: boolean;
    stdout: string | null;
    stderr: string | null;
  };
  stdin: string;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  timedOut: boolean;
}

/** POST /code/run → 200 CodeRunResult. Auth required. */
export async function runCode(input: CodeRunInput): Promise<CodeRunResult> {
  return unwrapData(
    apiClient.post<ApiEnvelope<CodeRunResult>>('/code/run', {
      problemId: input.problemId,
      language: input.language,
      sourceCode: input.sourceCode,
      ...(input.customInput !== undefined
        ? { customInput: input.customInput }
        : {}),
    }),
  );
}
