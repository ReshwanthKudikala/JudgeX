import { useMutation } from '@tanstack/react-query';

import { runCode, type CodeRunInput, type CodeRunResult } from '@/api/code.api';

/**
 * Single-shot Run Code against POST /code/run.
 * Independent of useSubmission — never touches submission state.
 */
export function useRunCode() {
  const mutation = useMutation({
    mutationFn: (input: CodeRunInput) => runCode(input),
  });

  return {
    run: mutation.mutateAsync as (input: CodeRunInput) => Promise<CodeRunResult>,
    isRunning: mutation.isPending,
    error: mutation.error,
  };
}
