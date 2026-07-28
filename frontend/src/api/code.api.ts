import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { EditorLanguage } from '@/features/editor/types';

/** POST /code/run request body. */
export interface CodeRunInput {
  problemId: string;
  language: EditorLanguage;
  sourceCode: string;
  /** When set, runs only this stdin (no sample comparison). */
  customInput?: string;
}

/** One public-sample (or custom) case from POST /code/run. */
export interface CodeRunCaseResult {
  index: number;
  input: string;
  expectedOutput: string | null;
  actualOutput: string | null;
  passed: boolean | null;
  runtimeMs: number | null;
  stderr: string | null;
  timedOut: boolean;
  exitCode: number | null;
}

/** POST /code/run success payload (matches backend CodeService). */
export interface CodeRunResult {
  status: 'ok' | 'compile_error' | 'runtime_error' | 'time_limit' | 'failed' | string;
  compile: {
    success: boolean;
    stdout: string | null;
    stderr: string | null;
  };
  results: CodeRunCaseResult[];
  passedCount: number;
  totalCount: number;
  /** Present on compile_error for convenience. */
  stderr?: string | null;
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
