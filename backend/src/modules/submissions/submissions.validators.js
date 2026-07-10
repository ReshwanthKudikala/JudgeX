// Request validation for submit (language, source size) and history listing.
// Structural/format validation only — business rules live in the service.

const { z } = require('zod');

// MVP languages (DATABASE_DESIGN.md §3.7 `language` enum).
const LANGUAGE = z.enum(['cpp', 'python']);
// Lifecycle + verdict enums (submissions.status / submissions.verdict).
const STATUS = z.enum(['queued', 'running', 'completed', 'error']);
const VERDICT = z.enum(['accepted', 'wrong_answer', 'tle', 'runtime_error', 'compile_error']);

// Cap source size to a reasonable bound to protect memory/DB (64 KiB).
const MAX_SOURCE_BYTES = 64 * 1024;

// POST /submissions — submit code for judging.
const createSubmissionSchema = z.object({
  problemId: z.string().uuid(),
  language: LANGUAGE,
  sourceCode: z
    .string()
    .min(1, 'Source code must not be empty.')
    .max(MAX_SOURCE_BYTES, 'Source code exceeds the maximum allowed size.'),
});

// GET /submissions — the current user's history (query params, all optional).
// Unknown keys are stripped; the repository additionally allow-lists sort/filter.
const listSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: STATUS.optional(),
  verdict: VERDICT.optional(),
  language: LANGUAGE.optional(),
  sort: z.string().trim().min(1).optional(),
});

module.exports = { createSubmissionSchema, listSubmissionsQuerySchema };
