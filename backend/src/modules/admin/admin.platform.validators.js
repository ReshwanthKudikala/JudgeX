const { z } = require('zod');

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  username: z.string().trim().min(1).max(30).optional(),
  email: z.string().trim().min(1).max(254).optional(),
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

const userIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const moderationListQuerySchema = z.object({
  entityType: z.enum(['problems', 'editorials', 'discussions', 'comments']).default('problems'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['published', 'unpublished', 'deleted', 'active']).optional(),
});

const bulkModerationSchema = z.object({
  entityType: z.enum(['problems', 'editorials', 'discussions', 'comments']),
  action: z.enum(['publish', 'unpublish', 'delete', 'restore']),
  ids: z.array(z.string().uuid()).min(1).max(100),
});

const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  action: z.string().trim().min(1).max(64).optional(),
  entityType: z.string().trim().min(1).max(32).optional(),
  actorId: z.string().uuid().optional(),
});

const queueFailedQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  end: z.coerce.number().int().min(0).max(200).optional(),
});

const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

module.exports = {
  listUsersQuerySchema,
  userIdParamsSchema,
  moderationListQuerySchema,
  bulkModerationSchema,
  auditLogsQuerySchema,
  queueFailedQuerySchema,
  analyticsQuerySchema,
};
