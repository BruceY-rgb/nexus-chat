/**
 * Auth Tools - Registration and Login Tools
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
    description: "Register a new user. AI can use this tool to autonomously register new users.",
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
      "User login, obtain authentication token. AI can use this tool to login and get userToken.",
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
    description: "User logout, invalidate current token",
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
    description: "Get current logged-in user's basic information",
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
    description: "Get current user's detailed profile",
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
      "Update current user's profile, can update display name, real name, avatar URL, timezone",
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
    description: "Send email verification email, no login authentication required",
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
