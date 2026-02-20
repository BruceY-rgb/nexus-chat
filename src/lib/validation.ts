// =====================================================
// Validation Schemas
// =====================================================

import { z } from 'zod';

// Registration validation schema
export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase letters and numbers'
    ),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must not exceed 50 characters'),
  realName: z
    .string()
    .min(2, 'Real name must be at least 2 characters')
    .max(50, 'Real name must not exceed 50 characters')
    .optional()
    .or(z.literal('')),
});

// Login validation schema
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter password'),
});

// Send verification code schema
export const sendVerificationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// Verification code login schema
export const verificationLoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter current password'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase letters and numbers'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Update user profile schema
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must not exceed 50 characters')
    .optional(),
  realName: z
    .string()
    .min(2, 'Real name must be at least 2 characters')
    .max(50, 'Real name must not exceed 50 characters')
    .optional()
    .or(z.literal('')),
  avatarUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  timezone: z.string().optional(),
});

// Validation function
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errors: Record<string, string> = {};
    result.error.errors.forEach((err) => {
      if (err.path.length > 0) {
        errors[err.path[0] as string] = err.message;
      }
    });
    return { success: false, errors };
  }
}
