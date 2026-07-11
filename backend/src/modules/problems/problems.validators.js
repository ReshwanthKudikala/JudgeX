// Request validation schemas for problem list queries and creation.
// Structural/format validation only — business rules live in the service.

const { z } = require('zod');

const DIFFICULTY = z.enum(['easy', 'medium', 'hard']);

const PROBLEM_SORT_FIELDS = ['createdAt', 'difficulty', 'title', 'totalSubmissions', 'totalAccepted'];

// Query strings arrive as text; accept common boolean encodings.
const queryBoolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const sortSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    const field = value.startsWith('-')
      ? value.slice(1)
      : value.includes(':')
        ? value.split(':')[0]
        : value;
    return PROBLEM_SORT_FIELDS.includes(field);
  }, { message: 'Invalid sort field.' });

// GET /problems — pagination/sorting/filtering query params (all optional).
// Unknown keys are stripped; the repository additionally allow-lists sort/filter.
const listProblemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: sortSchema.optional(),
  difficulty: DIFFICULTY.optional(),
  isPublished: queryBoolean.optional(),
  createdBy: z.string().uuid().optional(),
});

// POST /problems — create body. Required: slug, title, statement, difficulty.
const createProblemSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric words separated by hyphens.'),
  title: z.string().trim().min(1).max(200),
  statement: z.string().min(1).max(200_000),
  difficulty: DIFFICULTY,
  constraintsText: z.string().max(50_000).optional(),
  timeLimitMs: z.coerce.number().int().positive().optional(),
  memoryLimitMb: z.coerce.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
  createdBy: z.string().uuid().optional(),
});

const problemIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const problemSlugRouteParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid problem slug.'),
});

module.exports = {
  listProblemsQuerySchema,
  createProblemSchema,
  problemIdParamsSchema,
  problemSlugRouteParamsSchema,
};
