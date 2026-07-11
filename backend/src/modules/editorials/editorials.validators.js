const { z } = require('zod');

const DIFFICULTY = z.enum(['easy', 'medium', 'hard']);

const createEditorialSchema = z.object({
  title: z.string().trim().min(1).max(200),
  markdown: z.string().trim().min(1).max(200_000),
  difficulty: DIFFICULTY.optional(),
  published: z.boolean().optional(),
});

const updateEditorialSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    markdown: z.string().trim().min(1).max(200_000).optional(),
    difficulty: DIFFICULTY.optional(),
    published: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });

const problemIdParamsSchema = z.object({
  problemId: z.string().uuid(),
});

const editorialIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const problemSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

module.exports = {
  createEditorialSchema,
  updateEditorialSchema,
  problemIdParamsSchema,
  editorialIdParamsSchema,
  problemSlugParamsSchema,
};
