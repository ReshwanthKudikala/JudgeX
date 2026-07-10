// Request validation schemas for problem list queries and creation.
// Structural/format validation only — business rules live in the service.

const { z } = require('zod');

const DIFFICULTY = z.enum(['easy', 'medium', 'hard']);

// Query strings arrive as text; accept common boolean encodings.
const queryBoolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

// GET /problems — pagination/sorting/filtering query params (all optional).
// Unknown keys are stripped; the repository additionally allow-lists sort/filter.
const listProblemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().trim().min(1).optional(),
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
  statement: z.string().min(1),
  difficulty: DIFFICULTY,
  constraintsText: z.string().optional(),
  timeLimitMs: z.coerce.number().int().positive().optional(),
  memoryLimitMb: z.coerce.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
  createdBy: z.string().uuid().optional(),
});

module.exports = { listProblemsQuerySchema, createProblemSchema };
