/**
 * Auth Tools - 注册和登录工具
 */

import { z } from "zod";
import { apiExecutor } from "../executor.js";
import type {
  ToolDefinition,
  ExecutionContext,
  LoginResponse,
  ToolResult,
} from "../types.js";

// Register input schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
});

// Login input schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const logoutSchema = z.object({
  userToken: z.string(),
});

const getMeSchema = z.object({
  userToken: z.string(),
});

const getProfileSchema = z.object({
  userToken: z.string(),
});

const updateProfileSchema = z.object({
  displayName: z.string().optional(),
  realName: z.string().optional(),
  avatarUrl: z.string().optional(),
  timezone: z.string().optional(),
  userToken: z.string(),
});

const sendVerificationSchema = z.object({
  email: z.string().email(),
});

export const authTools: ToolDefinition[] = [
  {
    name: "register",
    description: "注册新用户。AI可以使用此工具自主注册新用户。",
    parameters: registerSchema,
    execute: async (args): Promise<ToolResult> => {
      try {
        const validatedArgs = registerSchema.parse(args);
        const result = await apiExecutor.publicPost<LoginResponse>(
          "/api/auth/register",
          validatedArgs,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "User registered successfully",
                userId: result.user.id,
                userName: result.user.displayName,
                email: result.user.email,
                token: result.token,
              }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "login",
    description:
      "用户登录，获取认证Token。AI可以使用此工具登录并获取userToken。",
    parameters: loginSchema,
    execute: async (args): Promise<ToolResult> => {
      try {
        const validatedArgs = loginSchema.parse(args);
        const result = await apiExecutor.publicPost<LoginResponse>(
          "/api/auth/login",
          validatedArgs,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Login successful",
                userId: result.user.id,
                userName: result.user.displayName,
                email: result.user.email,
                token: result.token,
              }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "logout",
    description: "用户登出，使当前Token失效",
    parameters: logoutSchema,
    execute: async (args): Promise<ToolResult> => {
      try {
        const validatedArgs = logoutSchema.parse(args);
        await apiExecutor.post("/api/auth/logout", validatedArgs.userToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, message: "Logged out" }),
            },
          ],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "get_me",
    description: "获取当前登录用户的基本信息",
    parameters: getMeSchema,
    execute: async (args): Promise<ToolResult> => {
      try {
        const validatedArgs = getMeSchema.parse(args);
        const result = await apiExecutor.get(
          "/api/auth/me",
          validatedArgs.userToken,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "get_profile",
    description: "获取当前用户的详细个人资料",
    parameters: getProfileSchema,
    execute: async (args): Promise<ToolResult> => {
      try {
        const validatedArgs = getProfileSchema.parse(args);
        const result = await apiExecutor.get(
          "/api/auth/profile",
          validatedArgs.userToken,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "update_profile",
    description:
      "更新当前用户的个人资料，可更新显示名、真实姓名、头像URL、时区",
    parameters: updateProfileSchema,
    execute: async (args): Promise<ToolResult> => {
      try {
        const validatedArgs = updateProfileSchema.parse(args);
        const { userToken, ...body } = validatedArgs;
        const result = await apiExecutor.put(
          "/api/auth/profile",
          userToken,
          body,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "send_verification",
    description: "发送邮箱验证邮件，无需登录认证",
    parameters: sendVerificationSchema,
    execute: async (args): Promise<ToolResult> => {
      try {
        const validatedArgs = sendVerificationSchema.parse(args);
        const result = await apiExecutor.publicPost(
          "/api/auth/send-verification",
          { email: validatedArgs.email },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
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
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      return parsed.token || null;
    } catch {
      return null;
    }
  }
  if (typeof result === "object" && result !== null) {
    return (result as { token?: string }).token || null;
  }
  return null;
}
