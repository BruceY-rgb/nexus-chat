/**
 * MCP Server Entry Point
 * Supports both stdio and http running modes
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpServer } from "./mcp-server-factory.js";
import { startHttpServer } from "./server-http.js";

const MCP_MODE = process.env.MCP_MODE || "http";

// Run the server based on mode
async function main() {
  if (MCP_MODE === "http") {
    // HTTP mode
    await startHttpServer();
    console.log(`Slack MCP Server running in HTTP mode`);
  } else {
    // Stdio mode
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Slack MCP Server running on stdio");
  }
}

main().catch(console.error);
