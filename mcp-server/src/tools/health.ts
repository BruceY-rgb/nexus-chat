/**
 * Health Tools - 健康检查工具
 */

import { z } from "zod";
import { config } from "../config.js";
import type { ToolDefinition, ToolResult } from "../types.js";

const healthCheckSchema = z.object({
  userToken: z.string().optional(),
});

export const healthTools: ToolDefinition[] = [
  {
    name: "health_check",
    description: "健康检查，返回数据库和WebSocket状态",
    parameters: healthCheckSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        healthCheckSchema.parse(args);
        const response = await fetch(`${config.INTERNAL_API_URL}/api/health`);
        const data = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
];
