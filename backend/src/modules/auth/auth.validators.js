// Zod request schemas for the auth module.
// Structural/format validation only — business rules live in the service.

const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.');

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username must be at most 30 characters.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may contain only letters, numbers, and underscores.'),
  email: z.string().trim().email('A valid email is required.').max(255),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const emailOnlySchema = z.object({
  email: z.string().trim().email('A valid email is required.').max(255),
});

const verifyEmailQuerySchema = z.object({
  token: z.string().min(1, 'A verification token is required.'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'A reset token is required.'),
  newPassword: passwordSchema,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: passwordSchema,
});

module.exports = {
  registerSchema,
  loginSchema,
  emailOnlySchema,
  verifyEmailQuerySchema,
  resetPasswordSchema,
  changePasswordSchema,
};
