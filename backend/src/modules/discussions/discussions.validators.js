const { z } = require('zod');

const SORT = z.enum(['newest', 'most_active', 'most_liked']);

const tagsSchema = z
  .array(z.string().trim().min(1).max(32))
  .max(8)
  .optional();

const createDiscussionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(50_000),
  tags: tagsSchema,
});

const updateDiscussionSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(50_000).optional(),
    tags: tagsSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });

const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
  parentCommentId: z.string().uuid().nullable().optional(),
});

const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
});

const reportSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

const listDiscussionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(32).optional(),
  sort: SORT.optional(),
});

const problemSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

const discussionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const commentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  createDiscussionSchema,
  updateDiscussionSchema,
  createCommentSchema,
  updateCommentSchema,
  reportSchema,
  listDiscussionsQuerySchema,
  problemSlugParamsSchema,
  discussionIdParamsSchema,
  commentIdParamsSchema,
};
