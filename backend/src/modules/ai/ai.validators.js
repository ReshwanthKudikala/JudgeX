// Request validation schemas for AI endpoints.

const { z } = require('zod');

const languageSchema = z.enum(['python', 'cpp']);

const explainCompileErrorSchema = z.object({
  submissionId: z.string().uuid(),
});

const explainSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
});

const analyzeComplexitySchema = z.object({
  problemId: z.string().uuid().optional(),
  language: languageSchema,
  sourceCode: z.string().trim().min(1).max(100_000),
});

const suggestOptimizationsSchema = z.object({
  problemId: z.string().uuid().optional(),
  language: languageSchema,
  sourceCode: z.string().trim().min(1).max(100_000),
});

const generateHintSchema = z.object({
  problemId: z.string().uuid(),
  hintLevel: z.coerce.number().int().min(1).max(4),
});

const learningAssistSchema = z.object({
  action: z
    .enum([
      'ask',
      'explain_code',
      'explain_verdict',
      'why_failed',
      'optimize',
      'suggest_optimizations',
      'complexity',
      'analyze_complexity',
      'hint',
      'generate_hint',
      'reveal_solution',
    ])
    .default('ask'),
  problemId: z.string().uuid().optional(),
  submissionId: z.string().uuid().optional(),
  language: languageSchema.optional(),
  sourceCode: z.string().trim().min(1).max(100_000).optional(),
  message: z.string().trim().min(1).max(2000).optional(),
  hintLevel: z.coerce.number().int().min(1).max(4).optional(),
  revealSolution: z.boolean().optional(),
});

module.exports = {
  explainCompileErrorSchema,
  explainSubmissionSchema,
  analyzeComplexitySchema,
  suggestOptimizationsSchema,
  generateHintSchema,
  learningAssistSchema,
};
