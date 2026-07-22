// Request validation for POST /code/run (fast feedback, not scored).

const { z } = require('zod');

const LANGUAGE = z.enum(['cpp', 'python']);
const MAX_SOURCE_BYTES = 64 * 1024;
const MAX_CUSTOM_INPUT_BYTES = 64 * 1024;

const runCodeSchema = z.object({
  problemId: z.string().uuid(),
  language: LANGUAGE,
  sourceCode: z
    .string()
    .min(1, 'Source code must not be empty.')
    .max(MAX_SOURCE_BYTES, 'Source code exceeds the maximum allowed size.'),
  customInput: z
    .string()
    .max(MAX_CUSTOM_INPUT_BYTES, 'Custom input exceeds the maximum allowed size.')
    .optional(),
});

module.exports = { runCodeSchema };
