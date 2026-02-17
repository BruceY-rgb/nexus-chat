/**
 * MCP Server Configuration
 */

import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { fileURLToPath } from 'url';

// ESM 模式下获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从项目根目录加载 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const configSchema = z.object({
  INTERNAL_API_URL: z.string().url().default('http://localhost:3000'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  return configSchema.parse({
    INTERNAL_API_URL: process.env.INTERNAL_API_URL || 'http://localhost:3000',
  });
}

export const config = loadConfig();
