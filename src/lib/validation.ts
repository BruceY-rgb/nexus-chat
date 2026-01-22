// =====================================================
// 验证模式
// =====================================================

import { z } from 'zod';

// 注册验证模式
export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z
    .string()
    .min(8, '密码至少8个字符')
    .max(100, '密码不能超过100个字符')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      '密码必须包含大小写字母和数字'
    ),
  displayName: z
    .string()
    .min(2, '昵称至少2个字符')
    .max(50, '昵称不能超过50个字符'),
  realName: z
    .string()
    .min(2, '真实姓名至少2个字符')
    .max(50, '真实姓名不能超过50个字符')
    .optional()
    .or(z.literal('')),
});

// 登录验证模式
export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

// 发送验证码验证模式
export const sendVerificationSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

// 验证码登录验证模式
export const verificationLoginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  code: z.string().length(6, '验证码为6位数字'),
});

// 更改密码验证模式
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z
    .string()
    .min(8, '密码至少8个字符')
    .max(100, '密码不能超过100个字符')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      '密码必须包含大小写字母和数字'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

// 更新用户资料验证模式
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, '昵称至少2个字符')
    .max(50, '昵称不能超过50个字符')
    .optional(),
  realName: z
    .string()
    .min(2, '真实姓名至少2个字符')
    .max(50, '真实姓名不能超过50个字符')
    .optional()
    .or(z.literal('')),
  avatarUrl: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  timezone: z.string().optional(),
});

// 验证函数
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