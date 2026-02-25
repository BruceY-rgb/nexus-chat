import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { setupWebSocket } from "./src/lib/websocket-server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import type { Server as SocketIOServer } from "socket.io";

// Declare global variable types
declare global {
  var io: SocketIOServer | undefined;
  var mcpProcess: ReturnType<typeof spawn> | undefined;
}

const dev = process.env.NODE_ENV !== "production";
// Fix: Must listen on 0.0.0.0 in containerized environments to accept external connections
const hostname =
  process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
const port = 3000;

// Add debug log
console.log("🔍 Debug - Environment Check:", {
  NODE_ENV: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === "production",
  hostname,
  dev,
});

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Global shutdown flag
let isShuttingDown = false;

// Start MCP server
function startMCPServer() {
  const isProduction = process.env.NODE_ENV === "production";
  const mcpDir = path.join(process.cwd(), "mcp-server");

  // Production environment: check if build artifacts exist
  const mcpEntryPoint = isProduction
    ? path.join(mcpDir, "dist/index.js")
    : path.join(mcpDir, "src/index.ts");

  if (!fs.existsSync(mcpEntryPoint)) {
    console.error(
      `[MCP] ERROR: ${mcpEntryPoint} not found. Run 'npm run mcp:build' first.`,
    );
    return;
  }

  const startMCP = () => {
    console.log(
      `🤖 Starting MCP Server (${isProduction ? "production" : "development"})...`,
    );

    const mcpProcess = spawn(
      isProduction ? "node" : "npx",
      isProduction ? [mcpEntryPoint] : ["tsx", "watch", mcpEntryPoint],
      {
        cwd: mcpDir,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        env: {
          ...process.env,
          PORT: process.env.MCP_PORT || "3002",
          HOST: "0.0.0.0",
          // Explicitly pass Internal API address to ensure MCP can correctly connect to Next.js
          INTERNAL_API_URL: "http://localhost:3000",
        },
      },
    );

    mcpProcess.stdout?.on("data", (data) => {
      process.stdout.write(`[MCP-LOG] ${data}`);
    });

    mcpProcess.stderr?.on("data", (data) => {
      process.stderr.write(`[MCP-LOG] ${data}`);
    });

    mcpProcess.on("error", (error) => {
      console.error("[MCP] Failed to start:", error);
    });

    mcpProcess.on("close", (code) => {
      console.log(`[MCP] Process exited with code ${code}`);
      if (!isShuttingDown) {
        console.log("[MCP] Restarting in 5 seconds...");
        setTimeout(startMCP, 5000);
      }
    });

    global.mcpProcess = mcpProcess;
    console.log("[MCP] Server started on port 3002");
  };

  startMCP();
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      // Parse URL
      const parsedUrl = parse(req.url || "/", true);

      // Handle request
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Set up WebSocket server
  const io = setupWebSocket(httpServer);

  // Store io instance in global variable so API routes can access it
  (global as any).io = io;
  (process as any).global = (global as any).io;

  // Add debug log
  console.log("🔧 [Setup] Global io instance set:", {
    globalExists: typeof (global as any).io !== "undefined",
    processExists: typeof (process as any).global !== "undefined",
    hasEngine: !!(global as any).io?.engine,
    hasNsps: !!(global as any).io?.nsps,
    socketCount: (global as any).io?.engine?.clientsCount,
  });

  // Start MCP server
  startMCPServer();

  // Error handling
  httpServer
    .once("error", (err) => {
      console.error("Server error:", err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🚀 Server ready at http://${hostname}:${port}`);
      console.log(`🔌 WebSocket server ready for connections`);
      console.log(
        `📝 API endpoints available at http://${hostname}:${port}/api`,
      );
      console.log(
        `🧪 MCP Test UI available at http://${hostname}:${port}/mcp-test`,
      );
    });
});

// Handle process exit
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  isShuttingDown = true;
  if (global.mcpProcess) {
    global.mcpProcess.kill();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down...");
  isShuttingDown = true;
  if (global.mcpProcess) {
    global.mcpProcess.kill();
  }
  process.exit(0);
});
