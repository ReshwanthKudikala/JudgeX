// Request validation schemas for AI endpoints.

const { z } = require('zod');

const explainCompileErrorSchema = z.object({
  submissionId: z.string().uuid(),
});

module.exports = { explainCompileErrorSchema };
