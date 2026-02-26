/**
 * MCP HTTP Server
 * Provides RESTful interface for Claude Desktop / Cursor connection
 * Supports both legacy POST-based JSON-RPC and standard SSE transport
 */

import express, { Request, Response } from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { login as authLogin, verifyToken } from "./auth.js";
import { tools, toolRegistry } from "./tools/index.js";
import { resources, resourceHandlers } from "./resources/index.js";
import { createMcpServer } from "./mcp-server-factory.js";
import type { ToolResult } from "./types.js";

const app = express();

// Middleware
app.use(cors());

// Global request log middleware (for debugging if requests arrived)
app.use((req: Request, _res: Response, next) => {
  console.log("");
  console.log("========== Request Received ==========");
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
  console.log("====================================");
  console.log("");
  next();
});

// Parse JSON body for all routes EXCEPT /mcp/sse/messages
// (SSEServerTransport reads the raw body stream itself via raw-body)
app.use((req: Request, res: Response, next) => {
  if (req.path === "/mcp/sse/messages") {
    return next();
  }
  express.json()(req, res, next);
});

// Port configuration
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || "0.0.0.0";

// External access URL (for logging display)
const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL || `http://${HOST}:${PORT}`;

// Routes

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Login endpoint
app.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await authLogin(email, password);

    if (!result.success || !result.token) {
      return res.status(401).json({ error: result.error || "Login failed" });
    }

    res.json({
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// MCP message handling
app.post("/mcp/messages", async (req: Request, res: Response) => {
  try {
    const message = req.body;
    const id = message?.id;

    // Verify JSON-RPC version
    if (message?.jsonrpc !== "2.0") {
      return res.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Invalid JSON-RPC version" },
      });
    }

    const method = message?.method;
    const params = message?.params || {};

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    let userToken: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      userToken = authHeader.substring(7);
    }

    // If no token, check userToken in params
    if (!userToken) {
      userToken = params?.arguments?.userToken as string;
    }

    // Tools that don't require authentication
    const noAuthTools = [
      "register",
      "login",
      "health_check",
      "send_verification",
    ];
    if (method === "tools/call" && noAuthTools.includes(params?.name)) {
      const result = await handleToolCall(
        params.name,
        params.arguments || {},
        null,
      );
      return res.json({ jsonrpc: "2.0", id, result });
    }

    // Verify token
    if (!userToken) {
      return res.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32001, message: "Unauthorized: userToken is required" },
      });
    }

    const decoded = verifyToken(userToken);
    if (!decoded) {
      return res.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32001, message: "Unauthorized: invalid token" },
      });
    }

    // Handle MCP methods
    let result: unknown;

    switch (method) {
      case "tools/list":
        result = {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: {
              type: "object",
              properties: {}, // Simplified handling
            },
          })),
        };
        break;

      case "tools/call":
        result = await handleToolCall(
          params.name,
          params.arguments || {},
          userToken,
        );
        break;

      case "resources/list":
        result = {
          resources: resources.map((resource) => ({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType,
          })),
        };
        break;

      case "resources/read":
        result = await handleResourceRead(params.uri, userToken);
        break;

      default:
        return res.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not found" },
        });
    }

    return res.json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    console.error("MCP message error:", error);
    return res.json({
      jsonrpc: "2.0",
      id: req.body?.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      },
    });
  }
});

// Handle tool calls
async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  userToken: string | null,
): Promise<ToolResult> {
  // Auth tools don't need token validation
  const noAuthToolNames = [
    "register",
    "login",
    "health_check",
    "send_verification",
  ];
  if (noAuthToolNames.includes(toolName)) {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Tool '${toolName}' not found` }),
          },
        ],
        isError: true,
      };
    }

    try {
      return await tool.execute(args, { userId: "", userToken: "" });
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error instanceof Error ? error.message : "Unknown error",
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Other tools need token validation
  if (!userToken) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: "userToken is required" }),
        },
      ],
      isError: true,
    };
  }

  const tool = toolRegistry.get(toolName);
  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: `Tool '${toolName}' not found` }),
        },
      ],
      isError: true,
    };
  }

  try {
    return await tool.execute(args, { userId: "", userToken });
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        },
      ],
      isError: true,
    };
  }
}

// Handle resource read
async function handleResourceRead(
  uri: string,
  userToken: string,
): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const url = new URL(uri);
  const tokenParam = url.searchParams.get("userToken");

  // Prefer token from header
  const actualToken = userToken || tokenParam;

  if (!actualToken) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            error: "userToken is required as query parameter",
          }),
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
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ error: `Resource '${baseUri}' not found` }),
        },
      ],
    };
  }

  try {
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key !== "userToken") {
        params[key] = value;
      }
    });

    const data = await handler(actualToken, params);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: data,
        },
      ],
    };
  } catch (error) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        },
      ],
    };
  }
}

// ============================================================
// Standard MCP SSE Transport
// GET /mcp/sse  - establishes SSE connection
// POST /mcp/sse/messages - receives client JSON-RPC messages
// ============================================================

// Active SSE sessions: sessionId -> transport
const sseTransports = new Map<string, SSEServerTransport>();

app.get("/mcp/sse", async (req: Request, res: Response) => {
  console.log("SSE connection request received");

  const transport = new SSEServerTransport("/mcp/sse/messages", res);
  const sessionId = transport.sessionId;
  sseTransports.set(sessionId, transport);

  console.log(`SSE session created: ${sessionId}`);

  // Create a new MCP server instance for this connection
  const mcpServer = createMcpServer();

  // Clean up on disconnect
  req.on("close", () => {
    console.log(`SSE session closed: ${sessionId}`);
    sseTransports.delete(sessionId);
    mcpServer.close().catch(console.error);
  });

  // Connect server to transport (this starts the SSE stream)
  await mcpServer.connect(transport);
});

app.post("/mcp/sse/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId query parameter" });
    return;
  }

  const transport = sseTransports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session not found. It may have expired." });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Start server
export function startHttpServer(): Promise<void> {
  return new Promise((resolve) => {
    const port = typeof PORT === "string" ? parseInt(PORT, 10) : PORT;
    const baseUrl = INTERNAL_API_URL || `http://localhost:${port}`;
    app.listen(port, HOST, () => {
      const startTime = new Date().toISOString();
      const MCP_MODE = process.env.MCP_MODE || "http";

      console.log("");
      console.log("========================================");
      console.log("MCP Server started successfully");
      console.log("========================================");
      console.log(`Mode: ${MCP_MODE.toUpperCase()}`);
      console.log(`Port: ${port}`);
      console.log(`Health check: ${baseUrl}/health`);
      console.log(`Login endpoint: POST ${baseUrl}/login`);
      console.log(`MCP messages: POST ${baseUrl}/mcp/messages`);
      console.log(`MCP SSE endpoint: GET ${baseUrl}/mcp/sse`);
      console.log(`Start time: ${startTime}`);
      console.log("========================================");
      console.log("");

      resolve();
    });
  });
}

export { app };
