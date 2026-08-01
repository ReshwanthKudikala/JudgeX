/**
 * Zod validation for POST /api/v1/ai/coach
 */

const { z } = require('zod');
const { COACH_ACTION_LIST } = require('./coach.actions');

const languageSchema = z.enum(['python', 'cpp']);

const publicCaseSchema = z
  .object({
    index: z.number().int().optional().nullable(),
    caseIndex: z.number().int().optional().nullable(),
    status: z.string().max(64).optional().nullable(),
    verdict: z.string().max(64).optional().nullable(),
    passed: z.boolean().optional().nullable(),
    input: z.string().max(20_000).optional().nullable(),
    expectedOutput: z.string().max(20_000).optional().nullable(),
    expected: z.string().max(20_000).optional().nullable(),
    actualOutput: z.string().max(20_000).optional().nullable(),
    stdout: z.string().max(20_000).optional().nullable(),
    stderr: z.string().max(8_000).optional().nullable(),
    runtimeMs: z.number().optional().nullable(),
    executionTime: z.number().optional().nullable(),
    isHidden: z.boolean().optional(),
    hidden: z.boolean().optional(),
    visibility: z.string().max(32).optional().nullable(),
  })
  .passthrough();

const lastRunResultSchema = z
  .object({
    status: z.string().max(64).optional().nullable(),
    compileSuccess: z.boolean().optional().nullable(),
    stderr: z.string().max(8_000).optional().nullable(),
    compile: z
      .object({
        success: z.boolean().optional().nullable(),
        stdout: z.string().max(8_000).optional().nullable(),
        stderr: z.string().max(8_000).optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
    results: z.array(publicCaseSchema).max(50).optional().nullable(),
    passedCount: z.number().int().optional().nullable(),
    totalCount: z.number().int().optional().nullable(),
  })
  .passthrough()
  .optional()
  .nullable();

const lastSubmissionSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    status: z.string().max(64).optional().nullable(),
    verdict: z.string().max(64).optional().nullable(),
    compileOutput: z.string().max(8_000).optional().nullable(),
    stderr: z.string().max(8_000).optional().nullable(),
    executionError: z.string().max(8_000).optional().nullable(),
    runtimeMs: z.number().optional().nullable(),
    executionTime: z.number().optional().nullable(),
    memoryKb: z.number().optional().nullable(),
    passedTests: z.number().int().optional().nullable(),
    totalTests: z.number().int().optional().nullable(),
    failedTestIndex: z.number().int().optional().nullable(),
  })
  .passthrough()
  .optional()
  .nullable();

const coachRequestSchema = z.object({
  problemId: z.string().uuid(),
  language: languageSchema,
  code: z.string().max(100_000).default(''),
  action: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(
      (v) => {
        const upper = v.toUpperCase().replace(/[\s-]+/g, '_');
        if (COACH_ACTION_LIST.includes(upper)) return true;
        // Allow legacy aliases; service resolves to UNKNOWN if unknown.
        return v.length > 0;
      },
      { message: 'Invalid action' },
    ),
  message: z.string().trim().max(2_000).default(''),
  lastRunResult: lastRunResultSchema,
  lastSubmission: lastSubmissionSchema,
});

module.exports = {
  coachRequestSchema,
};
