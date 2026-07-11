import { apiClient, unwrapData } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import type { AiCompileExplanation } from '@/types/submissions';
import type {
  AiLearningAssistInput,
  AiLearningReply,
} from '@/types/ai-assistant';

/**
 * POST /ai/explain-compile-error
 * Body: `{ submissionId }` — only valid when verdict is compile_error.
 */
export async function explainCompileError(
  submissionId: string,
): Promise<AiCompileExplanation> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AiCompileExplanation>>(
      '/ai/explain-compile-error',
      { submissionId },
    ),
  );
}

export async function explainSubmission(
  submissionId: string,
): Promise<AiLearningReply> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AiLearningReply>>('/ai/explain-submission', {
      submissionId,
    }),
  );
}

export async function analyzeComplexity(input: {
  problemId?: string;
  language: 'python' | 'cpp';
  sourceCode: string;
}): Promise<AiLearningReply> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AiLearningReply>>('/ai/analyze-complexity', input),
  );
}

export async function suggestOptimizations(input: {
  problemId?: string;
  language: 'python' | 'cpp';
  sourceCode: string;
}): Promise<AiLearningReply> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AiLearningReply>>(
      '/ai/suggest-optimizations',
      input,
    ),
  );
}

export async function generateHint(input: {
  problemId: string;
  hintLevel: 1 | 2 | 3 | 4;
}): Promise<AiLearningReply> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AiLearningReply>>('/ai/generate-hint', input),
  );
}

export async function learningAssist(
  input: AiLearningAssistInput,
): Promise<AiLearningReply> {
  return unwrapData(
    apiClient.post<ApiEnvelope<AiLearningReply>>('/ai/learning-assist', input),
  );
}
