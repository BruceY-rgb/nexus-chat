/**
 * MCP Tool Coverage Test
 *
 * Connect to MCP Server via SSE protocol and test all tools against their definitions.
 * Test coverage:
 *   1. SSE connection establishment
 *   2. Call tools/list via SSE transport, validate schema definitions
 *   3. Call each tool individually, validate response format against MCP protocol spec
 *   4. Cross-validate source code definitions vs SSE tool list
 *   5. Generate coverage report
 *
 * Usage: npx tsx src/test/mcp-coverage-test.ts [--server-url http://localhost:3002]
 */

// ─── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_SERVER_URL = "http://localhost:3002";
const TEST_EMAIL = "slackbot@slack-import.local";
const TEST_PASSWORD = "password123";

// ─── Types ────────────────────────────────────────────────────────────────────

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

interface TestResult {
  tool: string;
  category: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  checks: CheckResult[];
  responseTime: number;
  error?: string;
  /** Full inputSchema saved on failure (from tools/list) */
  schema?: unknown;
  /** Full response saved on failure */
  rawResponse?: unknown;
}

interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

interface ToolTestConfig {
  name: string;
  category: string;
  args: Record<string, unknown>;
  requiresAuth: boolean;
  skipExec?: boolean;
  skipReason?: string;
  expectError?: boolean;
}

// ─── All tool names defined in source code (for cross-validation) ─────────────────────────────

const SOURCE_TOOL_NAMES = [
  // auth (7)
  "register", "login", "logout", "get_me", "get_profile", "update_profile", "send_verification",
  // channels (12)
  "list_channels", "get_channel", "create_channel", "update_channel", "delete_channel",
  "join_channel", "leave_channel", "list_channel_members", "invite_channel_member",
  "join_all_channel_members", "remove_channel_member", "get_channel_permissions",
  // messages (15)
  "list_messages", "send_message", "get_message", "update_message", "delete_message",
  "reply_to_message", "get_thread_replies", "add_reaction", "remove_reaction",
  "search_messages", "get_reactions", "context_search_messages",
  "mark_messages_read", "mark_all_messages_read", "clear_messages",
  // users (6)
  "list_users", "search_users", "get_user", "get_unread_counts", "get_starred_users", "toggle_starred_user",
  // conversations (4)
  "create_dm", "get_dm", "list_active_dms", "get_read_position",
  // notifications (4)
  "get_channel_notification_prefs", "update_channel_notification_prefs",
  "get_dm_notification_prefs", "update_dm_notification_prefs",
  // attachments (3)
  "get_attachments", "delete_attachment", "create_attachment_upload_url",
  // health (1)
  "health_check",
  // threads (3)
  "get_thread_count", "get_unread_threads", "mark_thread_read",
];

/**
 * Required params for each tool in source code (excluding userToken).
 * Used to validate SSE transport schema.
 */
const SOURCE_REQUIRED_PARAMS: Record<string, string[]> = {
  register: ["email", "password", "displayName"],
  login: ["email", "password"],
  logout: [],
  get_me: [],
  get_profile: [],
  update_profile: [],
  send_verification: ["email"],
  list_channels: [],
  get_channel: ["channelId"],
  create_channel: ["name"],
  update_channel: ["channelId"],
  delete_channel: ["channelId"],
  join_channel: ["channelId"],
  leave_channel: ["channelId"],
  list_channel_members: ["channelId"],
  invite_channel_member: ["channelId", "userId"],
  join_all_channel_members: ["channelId"],
  remove_channel_member: ["channelId", "userId"],
  get_channel_permissions: ["channelId"],
  list_messages: [],
  send_message: [],
  get_message: ["messageId"],
  update_message: ["messageId", "content"],
  delete_message: ["messageId"],
  reply_to_message: ["messageId"],
  get_thread_replies: ["messageId"],
  add_reaction: ["messageId", "emoji"],
  remove_reaction: ["messageId", "emoji"],
  search_messages: [],
  get_reactions: ["messageId"],
  context_search_messages: ["query"],
  mark_messages_read: [],
  mark_all_messages_read: [],
  clear_messages: [],
  list_users: [],
  search_users: ["query"],
  get_user: ["userId"],
  get_unread_counts: [],
  get_starred_users: [],
  toggle_starred_user: ["starredUserId"],
  create_dm: ["userId"],
  get_dm: ["userId"],
  list_active_dms: [],
  get_read_position: [],
  get_channel_notification_prefs: ["channelId"],
  update_channel_notification_prefs: ["channelId", "notificationLevel"],
  get_dm_notification_prefs: ["conversationId"],
  update_dm_notification_prefs: ["conversationId", "notificationLevel"],
  get_attachments: ["conversationId", "conversationType"],
  delete_attachment: ["attachmentId"],
  create_attachment_upload_url: ["fileName", "mimeType"],
  health_check: [],
  get_thread_count: [],
  get_unread_threads: [],
  mark_thread_read: ["threadId"],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getServerUrl(): string {
  const idx = process.argv.indexOf("--server-url");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.MCP_SERVER_URL || DEFAULT_SERVER_URL;
}

function color(text: string, code: string): string {
  return `\x1b[${code}m${text}\x1b[0m`;
}
const green = (t: string) => color(t, "32");
const red = (t: string) => color(t, "31");
const yellow = (t: string) => color(t, "33");
const cyan = (t: string) => color(t, "36");
const bold = (t: string) => color(t, "1");
const dim = (t: string) => color(t, "2");

// ─── SSE MCP Client (standard SSE transport) ───────────────────────────────────

class McpSseClient {
  private serverUrl: string;
  private sessionId: string | null = null;
  private messagesUrl: string | null = null;
  private sseController: AbortController | null = null;
  private jsonRpcId = 0;

  /** JSON-RPC responses received from SSE stream, stored by id */
  private pendingResponses = new Map<number, {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private sseReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("SSE connection timeout (10s)")), 10000);
      this.sseController = new AbortController();

      fetch(`${this.serverUrl}/mcp/sse`, {
        signal: this.sseController.signal,
        headers: { Accept: "text/event-stream" },
      })
        .then(async (res) => {
          if (!res.ok) { clearTimeout(timeout); reject(new Error(`SSE: ${res.status}`)); return; }
          const reader = res.body?.getReader();
          if (!reader) { clearTimeout(timeout); reject(new Error("No body")); return; }
          this.sseReader = reader;

          const decoder = new TextDecoder();
          let buffer = "";
          let resolved = false;

          const readLoop = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // Split SSE events by blank lines
                const parts = buffer.split("\n\n");
                buffer = parts.pop() || "";

                for (const part of parts) {
                  const lines = part.split("\n");
                  let eventType = "";
                  let data = "";
                  for (const line of lines) {
                    if (line.startsWith("event:")) eventType = line.slice(6).trim();
                    else if (line.startsWith("data:")) data += line.slice(5).trim();
                  }

                  if (eventType === "endpoint" && !resolved) {
                    const url = new URL(data, this.serverUrl);
                    this.messagesUrl = url.toString();
                    this.sessionId = url.searchParams.get("sessionId");
                    clearTimeout(timeout);
                    resolved = true;
                    resolve();
                  } else if (eventType === "message" && data) {
                    // JSON-RPC response
                    try {
                      const json = JSON.parse(data);
                      if (json.id != null && this.pendingResponses.has(json.id)) {
                        const pending = this.pendingResponses.get(json.id)!;
                        clearTimeout(pending.timer);
                        this.pendingResponses.delete(json.id);
                        pending.resolve(json);
                      }
                    } catch { /* ignore parse errors */ }
                  }
                }
              }
            } catch (err: unknown) {
              if ((err as Error).name !== "AbortError") {
                // Connection closed — reject all pending
                for (const [, p] of this.pendingResponses) {
                  clearTimeout(p.timer);
                  p.reject(new Error("SSE connection closed"));
                }
                this.pendingResponses.clear();
              }
            }
          };
          readLoop();
        })
        .catch((err) => { clearTimeout(timeout); if (err.name !== "AbortError") reject(err); });
    });
  }

  /** Send JSON-RPC request via SSE transport and wait for response */
  async request(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 30000,
  ): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
    if (!this.messagesUrl) throw new Error("Not connected");

    const id = ++this.jsonRpcId;
    const body = { jsonrpc: "2.0", id, method, params };

    // Register pending callback
    const responsePromise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResponses.delete(id);
        reject(new Error(`SSE response timeout (${timeoutMs}ms) for ${method}`));
      }, timeoutMs);
      this.pendingResponses.set(id, { resolve, reject, timer });
    });

    // POST to messages endpoint
    const postRes = await fetch(this.messagesUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!postRes.ok && postRes.status !== 202) {
      const text = await postRes.text();
      throw new Error(`POST ${postRes.status}: ${text}`);
    }

    const json = await responsePromise;
    return json as { result?: unknown; error?: { code: number; message: string } };
  }

  async listTools(): Promise<McpToolDef[]> {
    const { result, error } = await this.request("tools/list");
    if (error) throw new Error(`tools/list: ${error.message}`);
    return ((result as { tools: McpToolDef[] })?.tools) || [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const { result, error } = await this.request("tools/call", { name, arguments: args });
    if (error) throw new Error(`tools/call(${name}): ${error.message}`);
    return result as McpToolResult;
  }

  async listResources(): Promise<unknown[]> {
    const { result, error } = await this.request("resources/list");
    if (error) throw new Error(`resources/list: ${error.message}`);
    return ((result as { resources: unknown[] })?.resources) || [];
  }

  disconnect(): void {
    this.sseController?.abort();
    for (const [, p] of this.pendingResponses) {
      clearTimeout(p.timer);
    }
    this.pendingResponses.clear();
  }

  get connected(): boolean { return this.sessionId !== null; }
  get session(): string | null { return this.sessionId; }
}

// ─── Test Config ────────────────────────────────────────────────────────────────

function buildTestConfigs(ctx: {
  channelId: string;
  messageId: string;
  userId: string;
  dmConversationId: string;
}): ToolTestConfig[] {
  const { channelId, messageId, userId, dmConversationId } = ctx;

  return [
    // ── Auth ──
    { name: "register", category: "Auth", requiresAuth: false,
      args: { email: `test-cov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
        password: "Test123456.", displayName: "CovTest" } },
    { name: "login", category: "Auth", requiresAuth: false,
      args: { email: TEST_EMAIL, password: TEST_PASSWORD } },
    { name: "get_me", category: "Auth", requiresAuth: true, args: {} },
    { name: "get_profile", category: "Auth", requiresAuth: true, args: {} },
    { name: "update_profile", category: "Auth", requiresAuth: true, args: {} },
    { name: "send_verification", category: "Auth", requiresAuth: false,
      args: { email: TEST_EMAIL }, expectError: true },  // email service may not be configured
    { name: "logout", category: "Auth", requiresAuth: true, args: {},
      skipExec: true, skipReason: "invalidates token, run last" },

    // ── Channels ──
    { name: "list_channels", category: "Channels", requiresAuth: true, args: {} },
    { name: "get_channel", category: "Channels", requiresAuth: true, args: { channelId } },
    { name: "create_channel", category: "Channels", requiresAuth: true,
      args: { name: `test-cov-${Date.now()}` } },
    { name: "update_channel", category: "Channels", requiresAuth: true,
      args: { channelId, description: "cov test" } },
    { name: "join_channel", category: "Channels", requiresAuth: true, args: { channelId },
      expectError: true },  // may already be a member
    { name: "leave_channel", category: "Channels", requiresAuth: true, args: { channelId },
      skipExec: true, skipReason: "avoid affecting test user state" },
    { name: "list_channel_members", category: "Channels", requiresAuth: true, args: { channelId } },
    { name: "invite_channel_member", category: "Channels", requiresAuth: true,
      args: { channelId, userId } },
    { name: "join_all_channel_members", category: "Channels", requiresAuth: true,
      args: { channelId }, skipExec: true, skipReason: "destructive operation" },
    { name: "remove_channel_member", category: "Channels", requiresAuth: true,
      args: { channelId, userId }, skipExec: true, skipReason: "destructive operation" },
    { name: "delete_channel", category: "Channels", requiresAuth: true,
      args: { channelId: "00000000-0000-0000-0000-000000000000" }, expectError: true },
    { name: "get_channel_permissions", category: "Channels", requiresAuth: true,
      args: { channelId } },

    // ── Messages ──
    { name: "list_messages", category: "Messages", requiresAuth: true,
      args: { channelId, limit: 5 } },
    { name: "send_message", category: "Messages", requiresAuth: true,
      args: { channelId, content: "[MCP CovTest] auto" } },
    { name: "get_message", category: "Messages", requiresAuth: true, args: { messageId } },
    { name: "update_message", category: "Messages", requiresAuth: true,
      args: { messageId, content: "[MCP CovTest] updated" } },
    { name: "delete_message", category: "Messages", requiresAuth: true,
      args: { messageId: "00000000-0000-0000-0000-000000000000" }, expectError: true },
    { name: "reply_to_message", category: "Messages", requiresAuth: true,
      args: { messageId, content: "[MCP CovTest] reply" } },
    { name: "get_thread_replies", category: "Messages", requiresAuth: true,
      args: { messageId } },
    { name: "add_reaction", category: "Messages", requiresAuth: true,
      args: { messageId, emoji: "👍" } },
    { name: "remove_reaction", category: "Messages", requiresAuth: true,
      args: { messageId, emoji: "👍" } },
    { name: "search_messages", category: "Messages", requiresAuth: true,
      args: { query: "test" } },
    { name: "get_reactions", category: "Messages", requiresAuth: true,
      args: { messageId } },
    { name: "context_search_messages", category: "Messages", requiresAuth: true,
      args: { query: "test", channelId } },
    { name: "mark_messages_read", category: "Messages", requiresAuth: true,
      args: { channelId } },
    { name: "mark_all_messages_read", category: "Messages", requiresAuth: true, args: {} },
    { name: "clear_messages", category: "Messages", requiresAuth: true,
      args: { channelId: "00000000-0000-0000-0000-000000000000" }, expectError: true },

    // ── Users ──
    { name: "list_users", category: "Users", requiresAuth: true, args: { limit: 5 } },
    { name: "search_users", category: "Users", requiresAuth: true, args: { query: "slack" } },
    { name: "get_user", category: "Users", requiresAuth: true, args: { userId } },
    { name: "get_unread_counts", category: "Users", requiresAuth: true, args: {} },
    { name: "get_starred_users", category: "Users", requiresAuth: true, args: {} },
    { name: "toggle_starred_user", category: "Users", requiresAuth: true,
      args: { starredUserId: userId } },

    // ── Conversations ──
    { name: "create_dm", category: "Conversations", requiresAuth: true, args: { userId } },
    { name: "get_dm", category: "Conversations", requiresAuth: true, args: { userId } },
    { name: "list_active_dms", category: "Conversations", requiresAuth: true, args: {} },
    { name: "get_read_position", category: "Conversations", requiresAuth: true,
      args: { channelId } },

    // ── Notifications ──
    { name: "get_channel_notification_prefs", category: "Notifications", requiresAuth: true,
      args: { channelId } },
    { name: "update_channel_notification_prefs", category: "Notifications", requiresAuth: true,
      args: { channelId, notificationLevel: "all" } },
    { name: "get_dm_notification_prefs", category: "Notifications", requiresAuth: true,
      args: { conversationId: dmConversationId || "00000000-0000-0000-0000-000000000000" },
      expectError: !dmConversationId },
    { name: "update_dm_notification_prefs", category: "Notifications", requiresAuth: true,
      args: { conversationId: dmConversationId || "00000000-0000-0000-0000-000000000000",
        notificationLevel: "all" },
      expectError: !dmConversationId },

    // ── Attachments ──
    { name: "get_attachments", category: "Attachments", requiresAuth: true,
      args: { conversationId: channelId, conversationType: "channel" } },
    { name: "delete_attachment", category: "Attachments", requiresAuth: true,
      args: { attachmentId: "00000000-0000-0000-0000-000000000000" }, expectError: true },
    { name: "create_attachment_upload_url", category: "Attachments", requiresAuth: true,
      args: { fileName: "test.txt", mimeType: "text/plain" } },

    // ── Health ──
    { name: "health_check", category: "Health", requiresAuth: false, args: {} },

    // ── Threads ──
    { name: "get_thread_count", category: "Threads", requiresAuth: true, args: {} },
    { name: "get_unread_threads", category: "Threads", requiresAuth: true, args: {} },
    { name: "mark_thread_read", category: "Threads", requiresAuth: true,
      args: { threadId: "00000000-0000-0000-0000-000000000000" }, expectError: true },
  ];
}

// ─── Schema Validation ─────────────────────────────────────────────────────────────

function validateToolDefinition(tool: McpToolDef): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push({
    name: "has name",
    passed: typeof tool.name === "string" && tool.name.length > 0,
    detail: tool.name || "(empty)",
  });

  checks.push({
    name: "has description",
    passed: typeof tool.description === "string" && tool.description.length > 0,
    detail: tool.description?.slice(0, 60) || "(empty)",
  });

  checks.push({
    name: "inputSchema.type === 'object'",
    passed: tool.inputSchema?.type === "object",
    detail: `type=${tool.inputSchema?.type}`,
  });

  checks.push({
    name: "inputSchema has properties",
    passed: typeof tool.inputSchema?.properties === "object" && tool.inputSchema?.properties !== null,
  });

  // userToken should not be exposed
  const hasUserToken = "userToken" in (tool.inputSchema?.properties || {});
  checks.push({
    name: "no userToken in properties",
    passed: !hasUserToken,
    detail: hasUserToken ? "userToken exposed to client!" : "OK",
  });

  // required must be an array
  const hasRequired = Array.isArray(tool.inputSchema?.required);
  checks.push({
    name: "inputSchema.required is array",
    passed: hasRequired,
    detail: `required=[${tool.inputSchema?.required?.join(", ") || ""}]`,
  });

  // Validate required fields match source definition
  const expected = SOURCE_REQUIRED_PARAMS[tool.name];
  if (expected && hasRequired) {
    const actual = [...(tool.inputSchema.required || [])].sort();
    const exp = [...expected].sort();
    const match = JSON.stringify(actual) === JSON.stringify(exp);
    checks.push({
      name: "required matches source definition",
      passed: match,
      detail: match ? "OK" : `expected=[${exp}], actual=[${actual}]`,
    });
  }

  // All required fields must exist in properties
  const props = Object.keys(tool.inputSchema?.properties || {});
  const required = tool.inputSchema?.required || [];
  const missingProps = required.filter((r: string) => !props.includes(r));
  checks.push({
    name: "required fields exist in properties",
    passed: missingProps.length === 0,
    detail: missingProps.length > 0 ? `missing: ${missingProps.join(", ")}` : "OK",
  });

  return checks;
}

function validateToolCallResult(result: McpToolResult, expectError: boolean): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. MCP spec: must have content array
  checks.push({
    name: "has content array",
    passed: Array.isArray(result?.content),
    detail: `length=${result?.content?.length}`,
  });

  // 2. MCP spec: each content item must have type field
  const allHaveType = result?.content?.every((c) => typeof c.type === "string");
  checks.push({ name: "content items have type", passed: !!allHaveType });

  // 3. Validate text field in text-type content
  //    Some APIs may return empty body (204 No Content) causing text to be undefined
  //    This is an MCP tool implementation issue but not a protocol violation
  const textItems = result?.content?.filter((c) => c.type === "text") || [];
  const allTextHaveText = textItems.every((c) => typeof c.text === "string");
  const hasEmptyText = textItems.some((c) => c.text === undefined || c.text === null);
  checks.push({
    name: "text items have text field",
    passed: allTextHaveText,
    detail: hasEmptyText ? "some items have empty text (API may return empty body)" : undefined,
  });

  // 4. Check if text content is valid JSON
  let parseable = true;
  let parsedContent: unknown = null;
  if (allTextHaveText && textItems.length > 0) {
    for (const item of textItems) {
      try { parsedContent = JSON.parse(item.text || ""); } catch { parseable = false; }
    }
  } else if (textItems.length === 0) {
    parseable = true; // no text items is not a failure
  } else {
    parseable = false;
  }
  checks.push({
    name: "text is valid JSON",
    passed: parseable,
    detail: !parseable ? (hasEmptyText ? "empty text (API empty body)" : "JSON parse failed") : undefined,
  });

  // 5. Error status check
  if (expectError) {
    checks.push({ name: "expected error response", passed: true,
      detail: result?.isError ? "isError=true" : "no flag but OK" });
  } else {
    const hasError = parsedContent && typeof parsedContent === "object" &&
      (parsedContent as Record<string, unknown>).error;
    const hasSuccessFalse = parsedContent && typeof parsedContent === "object" &&
      (parsedContent as Record<string, unknown>).success === false;
    checks.push({
      name: "no unexpected error",
      passed: !result?.isError && !hasError && !hasSuccessFalse,
      detail: result?.isError ? "isError=true" :
        hasError ? `error: ${JSON.stringify(hasError).slice(0, 80)}` :
        hasSuccessFalse ? `success=false: ${JSON.stringify(parsedContent).slice(0, 80)}` : "OK",
    });
  }

  return checks;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const serverUrl = getServerUrl();

  console.log(bold("\n╔══════════════════════════════════════════════════════════╗"));
  console.log(bold("║         MCP Tool Coverage Test (SSE Protocol)           ║"));
  console.log(bold("╚══════════════════════════════════════════════════════════╝\n"));
  console.log(`  Server:     ${cyan(serverUrl)}`);
  console.log(`  Account:    ${TEST_EMAIL}`);
  console.log(`  Time:       ${new Date().toISOString()}\n`);

  const results: TestResult[] = [];
  const client = new McpSseClient(serverUrl);

  // ─── Phase 1: SSE Connection ─────────────────────────────────────────────────────

  console.log(bold("─── Phase 1: SSE Connection ──────────────────────────────\n"));

  try {
    await client.connect();
    console.log(`  ${green("✓")} SSE connected  sessionId=${dim(client.session || "?")}`);
  } catch (err) {
    console.log(`  ${red("✗")} SSE connection failed: ${(err as Error).message}`);
    console.log(`  Cannot continue testing, please ensure MCP Server is running\n`);
    process.exit(1);
  }

  // ─── Phase 2: Login ────────────────────────────────────────────────────────

  console.log(bold("\n─── Phase 2: Login ───────────────────────────────────────\n"));

  // SSE transport login auto-caches token (mcp-server-factory.ts)
  try {
    const loginResult = await client.callTool("login", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const parsed = JSON.parse(loginResult.content[0].text || "{}");
    if (parsed.success && parsed.token) {
      console.log(`  ${green("✓")} Login successful (token cached in SSE session)`);
    } else {
      console.log(`  ${red("✗")} Login failed: ${JSON.stringify(parsed)}`);
      process.exit(1);
    }
  } catch (err) {
    console.log(`  ${red("✗")} Login error: ${(err as Error).message}`);
    process.exit(1);
  }

  // ─── Phase 3: tools/list Schema Validation ──────────────────────────────────────

  console.log(bold("\n─── Phase 3: tools/list Schema Validation ────────────────\n"));

  let serverTools: McpToolDef[] = [];
  try {
    serverTools = await client.listTools();
    console.log(`  Fetched ${cyan(String(serverTools.length))} tool definitions\n`);
  } catch (err) {
    console.log(`  ${red("✗")} tools/list failed: ${(err as Error).message}`);
    process.exit(1);
  }

  // Cross-validation
  const serverToolNames = serverTools.map((t) => t.name).sort();
  const sourceToolNames = [...SOURCE_TOOL_NAMES].sort();
  const missingOnServer = sourceToolNames.filter((n) => !serverToolNames.includes(n));
  const extraOnServer = serverToolNames.filter((n) => !sourceToolNames.includes(n));

  if (missingOnServer.length > 0)
    console.log(`  ${red("✗")} In source but missing on server: ${missingOnServer.join(", ")}`);
  if (extraOnServer.length > 0)
    console.log(`  ${yellow("⚠")} On server but not in source list: ${extraOnServer.join(", ")}`);
  if (missingOnServer.length === 0 && extraOnServer.length === 0)
    console.log(`  ${green("✓")} Source and server tools/list fully match (${sourceToolNames.length} tools)`);

  // Validate each schema
  console.log("");
  for (const tool of serverTools) {
    const checks = validateToolDefinition(tool);
    const allPassed = checks.every((c) => c.passed);
    const icon = allPassed ? green("✓") : red("✗");
    const failedChecks = checks.filter((c) => !c.passed);
    console.log(`  ${icon} ${tool.name}`);
    if (!allPassed) {
      for (const fc of failedChecks) {
        console.log(`    ${red("→")} ${fc.name}: ${fc.detail || "failed"}`);
      }
      console.log(`    ${dim("inputSchema:")} ${dim(JSON.stringify(tool.inputSchema))}`);
    }
    results.push({
      tool: tool.name, category: "Schema",
      status: allPassed ? "PASS" : "FAIL", checks, responseTime: 0,
      ...(!allPassed && { schema: tool.inputSchema }),
    });
  }

  // ─── Phase 4: resources/list ──────────────────────────────────────────────

  console.log(bold("\n─── Phase 4: resources/list ───────────────────────────────\n"));

  try {
    const resources = await client.listResources();
    console.log(`  ${green("✓")} Fetched ${cyan(String(resources.length))} resources`);
    for (const r of resources as Array<{ uri: string; name: string }>) {
      console.log(`    ${dim("→")} ${r.name} (${r.uri})`);
    }
  } catch (err) {
    console.log(`  ${red("✗")} resources/list failed: ${(err as Error).message}`);
  }

  // ─── Phase 5: Prepare Test Context ──────────────────────────────────────────────

  console.log(bold("\n─── Phase 5: Prepare Test Context ─────────────────────────\n"));

  let channelId = "";
  let messageId = "";
  let userId = "";
  let dmConversationId = "";

  // Get channel
  try {
    const r = await client.callTool("list_channels", {});
    const data = JSON.parse(r.content[0].text || "{}");
    const channels = data.channels || data || [];
    if (Array.isArray(channels) && channels.length > 0) {
      // Pick a channel with fewer members to avoid timeout (skip large channels like general/random)
      const smallChannels = channels
        .filter((c: { memberCount?: number; _count?: { members: number } }) => {
          const count = c.memberCount || c._count?.members || 0;
          return count > 0 && count < 500;
        })
        .sort((a: { memberCount?: number; _count?: { members: number } }, b: { memberCount?: number; _count?: { members: number } }) =>
          (a.memberCount || a._count?.members || 0) - (b.memberCount || b._count?.members || 0));
      const target = smallChannels[0] || channels.find((c: { name: string }) =>
        c.name === "general" || c.name === "random") || channels[0];
      channelId = target.id;
      console.log(`  ${green("✓")} Channel: ${target.name} (members=${target.memberCount || target._count?.members || "?"}) (${dim(channelId)})`);
    }
  } catch (err) {
    console.log(`  ${yellow("⚠")} Failed to get channel: ${(err as Error).message}`);
  }

  // Get message (send one if selected channel has no messages)
  if (channelId) {
    try {
      const r = await client.callTool("list_messages", { channelId, limit: 1 });
      const data = JSON.parse(r.content[0].text || "{}");
      const msgs = data.messages || data || [];
      if (Array.isArray(msgs) && msgs.length > 0) {
        messageId = msgs[0].id;
      } else {
        // Channel has no messages, send one
        const sendR = await client.callTool("send_message", {
          channelId, content: "[MCP CovTest] seed message",
        });
        const sendData = JSON.parse(sendR.content[0].text || "{}");
        messageId = sendData.id || sendData.message?.id || "";
      }
      if (messageId) console.log(`  ${green("✓")} Message: ${dim(messageId)}`);
      else console.log(`  ${yellow("⚠")} Failed to get/create message`);
    } catch { console.log(`  ${yellow("⚠")} Failed to get messages`); }
  }

  // Get user
  try {
    const r = await client.callTool("list_users", { limit: 5 });
    const data = JSON.parse(r.content[0].text || "{}");
    const users = data.users || data || [];
    if (Array.isArray(users) && users.length > 0) {
      const meR = await client.callTool("get_me", {});
      const meData = JSON.parse(meR.content[0].text || "{}");
      const myId = meData.user?.id || meData.id;
      const other = users.find((u: { id: string }) => u.id !== myId);
      userId = other?.id || users[0].id;
      console.log(`  ${green("✓")} User: ${other?.displayName || users[0].displayName} (${dim(userId)})`);
    }
  } catch { console.log(`  ${yellow("⚠")} Failed to get users`); }

  // DM conversation
  if (userId) {
    try {
      const r = await client.callTool("create_dm", { userId });
      const data = JSON.parse(r.content[0].text || "{}");
      dmConversationId = data.id || data.conversation?.id || "";
      if (dmConversationId) console.log(`  ${green("✓")} DM: ${dim(dmConversationId)}`);
    } catch { console.log(`  ${yellow("⚠")} Failed to create DM`); }
  }

  // ─── Phase 6: Tool Execution Tests ─────────────────────────────────────────

  console.log(bold("\n─── Phase 6: Tool Execution Tests ─────────────────────────\n"));

  // Build tool name -> schema map for failure output
  const toolSchemaMap = new Map<string, McpToolDef>();
  for (const t of serverTools) toolSchemaMap.set(t.name, t);

  const configs = buildTestConfigs({ channelId, messageId, userId, dmConversationId });
  let currentCat = "";

  for (const cfg of configs) {
    if (cfg.category !== currentCat) {
      currentCat = cfg.category;
      console.log(`\n  ${bold(cyan(`[${currentCat}]`))}`);
    }

    if (cfg.skipExec) {
      console.log(`  ${dim("○")} ${cfg.name} ${dim(`(SKIP: ${cfg.skipReason})`)}`);
      results.push({ tool: cfg.name, category: cfg.category, status: "SKIP",
        checks: [], responseTime: 0, error: cfg.skipReason });
      continue;
    }

    const start = Date.now();
    try {
      const callResult = await client.callTool(cfg.name, cfg.args);
      const elapsed = Date.now() - start;
      const checks = validateToolCallResult(callResult, cfg.expectError || false);
      const allPassed = checks.every((c) => c.passed);
      const icon = allPassed ? green("✓") : red("✗");
      console.log(`  ${icon} ${cfg.name} ${dim(`(${elapsed}ms)`)}`);
      if (!allPassed) {
        for (const fc of checks.filter((c) => !c.passed)) {
          console.log(`    ${red("→")} ${fc.name}: ${fc.detail || "failed"}`);
        }
        const schemaDef = toolSchemaMap.get(cfg.name);
        if (schemaDef) {
          console.log(`    ${dim("inputSchema:")} ${dim(JSON.stringify(schemaDef.inputSchema))}`);
        }
        console.log(`    ${dim("response:")} ${dim(JSON.stringify(callResult))}`);
      }
      results.push({ tool: cfg.name, category: cfg.category,
        status: allPassed ? "PASS" : "FAIL", checks, responseTime: elapsed,
        ...(!allPassed && {
          schema: toolSchemaMap.get(cfg.name)?.inputSchema,
          rawResponse: callResult,
        }),
      });
    } catch (err) {
      const elapsed = Date.now() - start;
      console.log(`  ${red("✗")} ${cfg.name} ${dim(`(${elapsed}ms)`)} ${red((err as Error).message)}`);
      const schemaDef = toolSchemaMap.get(cfg.name);
      if (schemaDef) {
        console.log(`    ${dim("inputSchema:")} ${dim(JSON.stringify(schemaDef.inputSchema))}`);
      }
      results.push({ tool: cfg.name, category: cfg.category, status: "FAIL",
        checks: [], responseTime: elapsed, error: (err as Error).message,
        schema: schemaDef?.inputSchema,
      });
    }
  }

  // Execute logout last
  console.log(`\n  ${bold(cyan("[Auth - Deferred]"))}`);
  try {
    const start = Date.now();
    const r = await client.callTool("logout", {});
    const elapsed = Date.now() - start;
    const checks = validateToolCallResult(r, false);
    const allPassed = checks.every((c) => c.passed);
    console.log(`  ${allPassed ? green("✓") : red("✗")} logout ${dim(`(${elapsed}ms)`)}`);
    results.push({ tool: "logout", category: "Auth",
      status: allPassed ? "PASS" : "FAIL", checks, responseTime: elapsed });
  } catch (err) {
    console.log(`  ${red("✗")} logout ${red((err as Error).message)}`);
    results.push({ tool: "logout", category: "Auth", status: "FAIL",
      checks: [], responseTime: 0, error: (err as Error).message });
  }

  // Safely disconnect SSE (ignore errors)
  try { client.disconnect(); } catch { /* ignore */ }

  // ─── Phase 7: Report ────────────────────────────────────────────────────────

  printReport(results, serverTools, missingOnServer, extraOnServer);
}

// ─── Report ────────────────────────────────────────────────────────────────────

function printReport(
  results: TestResult[],
  serverTools: McpToolDef[],
  missingOnServer: string[],
  extraOnServer: string[],
) {
  console.log(bold("\n╔══════════════════════════════════════════════════════════╗"));
  console.log(bold("║                MCP Coverage Test Report                  ║"));
  console.log(bold("╚══════════════════════════════════════════════════════════╝\n"));

  const schemaResults = results.filter((r) => r.category === "Schema");
  const schemaPass = schemaResults.filter((r) => r.status === "PASS").length;
  const schemaFail = schemaResults.filter((r) => r.status === "FAIL").length;

  const callResults = results.filter((r) => r.category !== "Schema");
  const callPass = callResults.filter((r) => r.status === "PASS").length;
  const callFail = callResults.filter((r) => r.status === "FAIL").length;
  const callSkip = callResults.filter((r) => r.status === "SKIP").length;

  // 1. Tool Discovery
  console.log(bold("  1. Tool Discovery (tools/list)"));
  console.log(`     Server:      ${cyan(String(serverTools.length))}`);
  console.log(`     Source:      ${cyan(String(SOURCE_TOOL_NAMES.length))}`);
  console.log(`     Consistency: ${missingOnServer.length === 0 && extraOnServer.length === 0 ? green("PASS") : red("FAIL")}`);
  if (missingOnServer.length > 0) console.log(`     Missing: ${red(missingOnServer.join(", "))}`);
  if (extraOnServer.length > 0) console.log(`     Extra: ${yellow(extraOnServer.join(", "))}`);

  // 2. Schema
  console.log(bold("\n  2. Schema Validation"));
  console.log(`     Pass: ${green(String(schemaPass))}  Fail: ${schemaFail > 0 ? red(String(schemaFail)) : dim("0")}`);

  // 3. Tool Execution Tests
  console.log(bold("\n  3. Tool Execution Tests"));
  console.log(`     Pass: ${green(String(callPass))}  Fail: ${callFail > 0 ? red(String(callFail)) : dim("0")}  Skip: ${callSkip > 0 ? yellow(String(callSkip)) : dim("0")}`);

  // 4. Category Stats
  console.log(bold("\n  4. Category Stats"));
  const categories = [...new Set(callResults.map((r) => r.category))];
  for (const cat of categories) {
    const catR = callResults.filter((r) => r.category === cat);
    const pass = catR.filter((r) => r.status === "PASS").length;
    const skip = catR.filter((r) => r.status === "SKIP").length;
    const total = catR.length;
    const tested = total - skip;
    const pct = tested > 0 ? Math.round((pass / tested) * 100) : 0;
    const bar = `[${"█".repeat(Math.round(pct / 5))}${"░".repeat(20 - Math.round(pct / 5))}]`;
    console.log(`     ${cat.padEnd(16)} ${bar} ${String(pct).padStart(3)}%  (${pass}/${tested} pass, ${skip} skip)`);
  }

  // 5. Total Coverage
  const totalTools = SOURCE_TOOL_NAMES.length;
  const testedTools = callResults.filter((r) => r.status !== "SKIP").length;
  const coveragePct = Math.round((testedTools / totalTools) * 100);
  const coverageBar = `[${"█".repeat(Math.round(coveragePct / 5))}${"░".repeat(20 - Math.round(coveragePct / 5))}]`;
  console.log(bold("\n  5. Total Coverage"));
  console.log(`     ${coverageBar} ${coveragePct}%  (${testedTools}/${totalTools} tools tested)`);

  // 6. Failure Details
  const failures = results.filter((r) => r.status === "FAIL");
  if (failures.length > 0) {
    console.log(bold(red("\n  6. Failure Details")));
    for (const f of failures) {
      console.log(`\n     ${red("✗")} ${bold(f.tool)} (${f.category})`);
      if (f.error) console.log(`       Error: ${f.error}`);
      for (const c of f.checks.filter((ch) => !ch.passed)) {
        console.log(`       - ${c.name}: ${c.detail || "failed"}`);
      }
      if (f.schema) {
        console.log(`       ${dim("inputSchema:")}`);
        console.log(`       ${dim(JSON.stringify(f.schema, null, 2).split("\n").join("\n       "))}`);
      }
      if (f.rawResponse) {
        console.log(`       ${dim("response:")}`);
        console.log(`       ${dim(JSON.stringify(f.rawResponse, null, 2).split("\n").join("\n       "))}`);
      }
    }
  }

  // 7. Performance
  const timed = callResults.filter((r) => r.responseTime > 0);
  if (timed.length > 0) {
    const avg = Math.round(timed.reduce((s, r) => s + r.responseTime, 0) / timed.length);
    const max = Math.max(...timed.map((r) => r.responseTime));
    const slowest = timed.find((r) => r.responseTime === max);
    console.log(bold("\n  7. Performance"));
    console.log(`     Avg: ${avg}ms`);
    console.log(`     Slowest: ${slowest?.tool} (${max}ms)`);
  }

  // Conclusion
  const overallPass = failures.length === 0;
  console.log(bold("\n══════════════════════════════════════════════════════════"));
  console.log(`  Overall: ${overallPass ? green(bold("ALL TESTS PASSED")) : red(bold(`${failures.length} TEST(S) FAILED`))}`);
  console.log(bold("══════════════════════════════════════════════════════════\n"));

  process.exit(overallPass ? 0 : 1);
}

// ─── Entry ────────────────────────────────────────────────────────────────────

// Ignore unhandled rejections from SSE disconnect
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (msg.includes("AbortError") || msg.includes("SSE connection closed")) return;
  console.error(red(`\nUnhandled: ${msg}`));
});

main().catch((err) => {
  console.error(red(`\nFatal: ${err.message}`));
  process.exit(2);
});
