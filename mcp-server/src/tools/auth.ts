/**
 * Auth Tools - 注册和登录工具
 */

import { z } from 'zod';
import { apiExecutor } from '../executor.js';
import type { ToolDefinition, ExecutionContext, LoginResponse, ToolResult } from '../types.js';

// Register input schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

// Login input schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authTools: ToolDefinition[] = [
  {
    name: 'register',
    description: '注册新用户。AI可以使用此工具自主注册新用户。',
    parameters: registerSchema,
    execute: async (args): Promise<ToolResult> => {
      try {
        const validatedArgs = registerSchema.parse(args);
        const result = await apiExecutor.publicPost<LoginResponse>(
          '/api/auth/register',
          validatedArgs
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'User registered successfully',
                userId: result.user.id,
                userName: result.user.name,
                email: result.user.email,
                token: result.token,
              }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: 'login',
    description: '用户登录，获取认证Token。AI可以使用此工具登录并获取userToken。',
    parameters: loginSchema,
    execute: async (args): Promise<ToolResult> => {
      try {
        const validatedArgs = loginSchema.parse(args);
        const result = await apiExecutor.publicPost<LoginResponse>(
          '/api/auth/login',
          validatedArgs
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Login successful',
                userId: result.user.id,
                userName: result.user.name,
                email: result.user.email,
                token: result.token,
              }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  },
];

// Helper function to extract token from login/register result
export function extractToken(result: unknown): string | null {
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      return parsed.token || null;
    } catch {
      return null;
    }
  }
  if (typeof result === 'object' && result !== null) {
    return (result as { token?: string }).token || null;
  }
  return null;
}
