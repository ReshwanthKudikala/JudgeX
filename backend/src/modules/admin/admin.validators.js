// Zod request schemas for the admin problem-management API.
// Structural/format validation only — business rules live in the services.

const { z } = require('zod');

const DIFFICULTY = z.enum(['easy', 'medium', 'hard']);

const SLUG = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric words separated by hyphens.');

// POST /admin/problems — create.
const createProblemSchema = z.object({
  slug: SLUG,
  title: z.string().trim().min(1).max(200),
  statement: z.string().min(1),
  difficulty: DIFFICULTY,
  constraintsText: z.string().optional(),
  timeLimitMs: z.coerce.number().int().positive().optional(),
  memoryLimitMb: z.coerce.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
});

// PATCH /admin/problems/:id — partial update; at least one field required.
const updateProblemSchema = z
  .object({
    slug: SLUG.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    statement: z.string().min(1).optional(),
    difficulty: DIFFICULTY.optional(),
    constraintsText: z.string().optional(),
    timeLimitMs: z.coerce.number().int().positive().optional(),
    memoryLimitMb: z.coerce.number().int().positive().optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });

// PUT /admin/problems/:id/testcases — replace the whole set (inline payloads).
const replaceTestCasesSchema = z.object({
  testCases: z
    .array(
      z.object({
        input: z.string(),
        expectedOutput: z.string(),
        isHidden: z.boolean().optional(),
        displayOrder: z.coerce.number().int().min(0).optional(),
      }),
    )
    .min(1, 'At least one test case is required.'),
});

module.exports = { createProblemSchema, updateProblemSchema, replaceTestCasesSchema };
