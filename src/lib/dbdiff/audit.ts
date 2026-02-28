// =====================================================
// Audit DB writes into db_write_audit table
// =====================================================

import { PrismaClient } from "@prisma/client";

// Map from Prisma model name → SQL table name
export const MODEL_TABLE_MAP: Record<string, string> = {
  User: "users",
  Channel: "channels",
  ChannelMember: "channel_members",
  DMConversation: "dm_conversations",
  DMConversationMember: "dm_conversation_members",
  Message: "messages",
  MessageMention: "message_mentions",
  MessageRead: "message_reads",
  MessageReaction: "message_reactions",
  Attachment: "attachments",
  Notification: "notifications",
  NotificationSettings: "notification_settings",
  TeamMember: "team_members",
  UserSession: "user_sessions",
  // DbWriteAudit → SKIP (never audit the audit table)
};

export interface AuditDbWriteParams {
  prisma: PrismaClient;
  table: string;
  op: "INSERT" | "UPDATE" | "DELETE" | "UPSERT";
  pk: Record<string, unknown>;
  set?: Record<string, unknown>;
  unset?: string[];
  requestId?: string;
  txnId?: string;
  actor?: string;
}

/**
 * Insert one row into db_write_audit using $executeRaw (bypasses middleware → no recursion).
 */
export async function auditDbWrite({
  prisma,
  table,
  op,
  pk,
  set = {},
  unset = [],
  requestId,
  txnId,
  actor,
}: AuditDbWriteParams): Promise<void> {
  try {
    const tsMs = BigInt(Date.now());
    const pkJson = JSON.stringify(pk);
    const setJson = JSON.stringify(set);
    const unsetCols = JSON.stringify(unset);

    await prisma.$executeRaw`
      INSERT INTO db_write_audit
        (ts_ms, table_name, op, pk_json, set_json, unset_cols, request_id, txn_id, actor)
      VALUES
        (${tsMs}, ${table}, ${op}, ${pkJson}::jsonb, ${setJson}::jsonb, ${unsetCols}::jsonb,
         ${requestId ?? null}, ${txnId ?? null}, ${actor ?? null})
    `;
  } catch (err) {
    // Audit failures must never break normal operations
    console.error("[dbdiff] auditDbWrite failed:", err);
  }
}
