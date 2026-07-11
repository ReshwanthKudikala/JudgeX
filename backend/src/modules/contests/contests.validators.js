// Zod validators for contest APIs.

const { z } = require('zod');

const VISIBILITY = z.enum(['public', 'private']);
const STATUS = z.enum(['upcoming', 'running', 'ended']);

const contestProblemSchema = z.object({
  problemId: z.string().uuid(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  points: z.coerce.number().int().positive().optional(),
});

const createContestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  visibility: VISIBILITY.optional(),
  problems: z.array(contestProblemSchema).optional(),
});

const updateContestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    durationMinutes: z.coerce.number().int().positive().optional(),
    visibility: VISIBILITY.optional(),
    problems: z.array(contestProblemSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });

const listContestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: STATUS.optional(),
});

const scoreboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const contestIdParamsSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  createContestSchema,
  updateContestSchema,
  listContestsQuerySchema,
  scoreboardQuerySchema,
  contestIdParamsSchema,
};
