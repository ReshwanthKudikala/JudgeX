import { z } from 'zod';

const emailSchema = z.string().trim().email('A valid email is required.').max(255);

/**
 * Login form accepts “email or username” in the UI.
 * The backend login contract only accepts `email`, so a username-only value
 * fails client validation with a clear message (no API contract change).
 */
export const loginSchema = z.object({
  emailOrUsername: z
    .string()
    .trim()
    .min(1, 'Email or username is required.')
    .refine(
      (value) => emailSchema.safeParse(value).success,
      'Please sign in with your email address.',
    ),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().default(true),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters.')
      .max(80, 'Name must be at most 80 characters.'),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters.')
      .max(30, 'Username must be at most 30 characters.')
      .regex(
        /^[a-zA-Z0-9_]+$/,
        'Username may contain only letters, numbers, and underscores.',
      ),
    email: emailSchema,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128, 'Password must be at most 128 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
