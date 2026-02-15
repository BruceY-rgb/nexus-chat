/**
 * MCP Server Entry Point
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { tools, toolRegistry } from './tools/index.js';
import { resources, resourceHandlers } from './resources/index.js';

// Simple schema parser
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseZodSchema(schema: any): { properties: Record<string, unknown>; required: string[] } {
  try {
    const shape = schema._def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      if (key === 'userToken') continue;

      const zodDef = (value as { _def?: { typeName?: string; innerType?: unknown; options?: unknown[] } })._def;
      if (!zodDef) continue;

      const prop: Record<string, unknown> = {};
      const typeName = zodDef.typeName;

      if (typeName === 'ZodString') {
        prop.type = 'string';
      } else if (typeName === 'ZodNumber') {
        prop.type = 'number';
      } else if (typeName === 'ZodBoolean') {
        prop.type = 'boolean';
      } else if (typeName === 'ZodOptional') {
        const inner = (zodDef.innerType as { _def?: { typeName?: string } })?._def;
        if (inner?.typeName === 'ZodString') prop.type = 'string';
        else if (inner?.typeName === 'ZodNumber') prop.type = 'number';
        else if (inner?.typeName === 'ZodBoolean') prop.type = 'boolean';
        continue; // Skip optional fields
      } else if (typeName === 'ZodEnum') {
        prop.type = 'string';
        prop.enum = zodDef.options;
      } else if (typeName === 'ZodArray') {
        prop.type = 'array';
      } else if (typeName === 'ZodObject') {
        prop.type = 'object';
      }

      properties[key] = prop;
      required.push(key);
    }

    return { properties, required };
  } catch {
    return { properties: {}, required: [] };
  }
}

// Create server
const server = new Server(
  {
    name: 'slack-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map((tool) => {
      const { properties, required } = parseZodSchema(tool.parameters as any);
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties,
          required,
        },
      };
    }),
  };
});

// Call Tool Handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(server.setRequestHandler as any)(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;
  const argsObj = args as Record<string, unknown>;

  // Auth tools don't need userToken
  if (name === 'register' || name === 'login') {
    const tool = toolRegistry.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Tool '${name}' not found` }) }],
        isError: true,
      };
    }

    try {
      const result = await tool.execute(argsObj || {}, { userId: '', userToken: '' });
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  }

  // Get userToken from args
  const userToken = argsObj?.userToken as string;
  if (!userToken) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
      isError: true,
    };
  }

  const tool = toolRegistry.get(name);
  if (!tool) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Tool '${name}' not found` }) }],
      isError: true,
    };
  }

  try {
    const result = await tool.execute(argsObj || {}, { userId: '', userToken });
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
      isError: true,
    };
  }
});

// List Resources Handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: resources.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    })),
  };
});

// Read Resource Handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const uriString = uri as string;

  const url = new URL(uriString);
  const userToken = url.searchParams.get('userToken');

  if (!userToken) {
    return {
      contents: [
        {
          uri: uriString,
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'userToken is required as query parameter' }),
        },
      ],
    };
  }

  const baseUri = `${url.protocol}//${url.host}${url.pathname}`;
  const handler = resourceHandlers.get(baseUri);

  if (!handler) {
    return {
      contents: [
        {
          uri: uriString,
          mimeType: 'application/json',
          text: JSON.stringify({ error: `Resource '${baseUri}' not found` }),
        },
      ],
    };
  }

  try {
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key !== 'userToken') {
        params[key] = value;
      }
    });

    const data = await handler(userToken, params);
    return {
      contents: [
        {
          uri: uriString,
          mimeType: 'application/json',
          text: data,
        },
      ],
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      contents: [
        {
          uri: uriString,
          mimeType: 'application/json',
          text: JSON.stringify({ error: errorMessage }),
        },
      ],
    };
  }
});

// Run the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Slack MCP Server running on stdio');
}

main().catch(console.error);
