// =====================================================
// Prisma Client Initialization
// =====================================================

import { PrismaClient } from "@prisma/client";
import { MODEL_TABLE_MAP, auditDbWrite } from "./dbdiff/audit";
import { getRequestId } from "./dbdiff/context";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const WRITE_ACTIONS = new Set(["create", "update", "delete", "upsert"]);
const BATCH_WRITE_ACTIONS = new Set([
  "createMany",
  "createManyAndReturn",
  "updateMany",
  "deleteMany",
]);

// Map Prisma model name → client accessor (for pre-fetch in batch ops)
const MODEL_ACCESSOR_MAP: Record<string, string> = {
  User: "user",
  Channel: "channel",
  ChannelMember: "channelMember",
  DMConversation: "dMConversation",
  DMConversationMember: "dMConversationMember",
  Message: "message",
  MessageMention: "messageMention",
  MessageRead: "messageRead",
  MessageReaction: "messageReaction",
  Attachment: "attachment",
  Notification: "notification",
  NotificationSettings: "notificationSettings",
  TeamMember: "teamMember",
  UserSession: "userSession",
};

function createPrismaClient() {
  const client = new PrismaClient({
    log: ["query", "error", "warn"],
  });

  client.$use(async (params, next) => {
    if (!params.model || params.model === "DbWriteAudit") return next(params);

    const table = MODEL_TABLE_MAP[params.model];
    if (!table) return next(params);

    const requestId = getRequestId();
    const accessor = MODEL_ACCESSOR_MAP[params.model];

    // ── Single-row operations ──────────────────────────────────────────────
    if (WRITE_ACTIONS.has(params.action)) {
      const result = await next(params);
      try {
        if (params.action === "create") {
          await auditDbWrite({ prisma: client, table, op: "INSERT", pk: { id: result.id }, set: result, requestId });
        } else if (params.action === "upsert") {
          await auditDbWrite({ prisma: client, table, op: "UPSERT", pk: { id: result.id }, set: result, requestId });
        } else if (params.action === "update") {
          await auditDbWrite({ prisma: client, table, op: "UPDATE", pk: { id: result.id }, set: result, requestId });
        } else if (params.action === "delete") {
          await auditDbWrite({ prisma: client, table, op: "DELETE", pk: { id: result.id }, set: {}, requestId });
        }
      } catch (err) {
        console.error("[dbdiff] middleware audit error:", err);
      }
      return result;
    }

    // ── Batch operations ───────────────────────────────────────────────────
    if (BATCH_WRITE_ACTIONS.has(params.action)) {
      // deleteMany / updateMany: pre-fetch PKs BEFORE the mutation
      let preFetchedPks: { id: string }[] = [];
      if (
        (params.action === "deleteMany" || params.action === "updateMany") &&
        accessor
      ) {
        try {
          preFetchedPks = await (client as any)[accessor].findMany({
            where: params.args?.where ?? {},
            select: { id: true },
          });
        } catch (err) {
          console.error("[dbdiff] batch pre-fetch error:", err);
        }
      }

      const result = await next(params);

      try {
        if (params.action === "createManyAndReturn") {
          const rows: Record<string, unknown>[] = Array.isArray(result) ? result : [];
          for (const row of rows) {
            await auditDbWrite({ prisma: client, table, op: "INSERT", pk: { id: row.id }, set: row, requestId });
          }
        } else if (params.action === "createMany") {
          const dataItems: Record<string, unknown>[] = Array.isArray(params.args?.data)
            ? params.args.data
            : params.args?.data
            ? [params.args.data]
            : [];
          for (const item of dataItems) {
            await auditDbWrite({
              prisma: client,
              table,
              op: "INSERT",
              pk: item.id ? { id: item.id } : item,
              set: item,
              requestId,
            });
          }
        } else if (params.action === "updateMany") {
          const updateData = params.args?.data ?? {};
          for (const { id } of preFetchedPks) {
            await auditDbWrite({ prisma: client, table, op: "UPDATE", pk: { id }, set: updateData, requestId });
          }
        } else if (params.action === "deleteMany") {
          for (const { id } of preFetchedPks) {
            await auditDbWrite({ prisma: client, table, op: "DELETE", pk: { id }, set: {}, requestId });
          }
        }
      } catch (err) {
        console.error("[dbdiff] batch middleware audit error:", err);
      }

      return result;
    }

    return next(params);
  });

  return client;
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
