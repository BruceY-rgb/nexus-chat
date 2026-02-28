// =====================================================
// POST /api/dbdiff/compute
// Input:  { from: number, to: number, config?, request_id? }
// Output: { diff, canonical, exact_hash, debug }
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DBDiff, DBDiffWarning, RowOp, CanonicalizeCfg } from "@/lib/dbdiff/types";
import { canonicalizeDiff } from "@/lib/dbdiff/canonicalize";
import { hashDiff } from "@/lib/dbdiff/hash";

/**
 * Default noise columns applied to ALL tables automatically.
 * These are time/audit fields that carry no business-logic signal
 * and would cause hash drift between replays.
 */
export const DEFAULT_NOISE_COLS: string[] = [
  // timestamps
  "createdAt",
  "updatedAt",
  "deletedAt",
  "joinedAt",
  "lastSeenAt",
  "lastAccessedAt",
  "lastMessageAt",
  "lastReplyAt",
  "lastReadAt",
  "readAt",
  "emailCodeExpiresAt",
  "expiresAt",
  // auth / session internals
  "passwordHash",
  "tokenHash",
  "emailVerificationCode",
  // network metadata
  "ipAddress",
  "userAgent",
];

interface AuditRow {
  audit_id: bigint;
  ts_ms: bigint;
  table_name: string;
  op: string;
  pk_json: unknown;
  set_json: unknown;
  unset_cols: unknown;
  request_id: string | null;
  txn_id: string | null;
  actor: string | null;
}

// Returns null when pk is empty/missing → caller emits INVALID_PK warning
function toRowOp(row: AuditRow): RowOp | null {
  const pk = (
    typeof row.pk_json === "string" ? JSON.parse(row.pk_json) : row.pk_json
  ) as Record<string, unknown>;
  const set = (
    typeof row.set_json === "string" ? JSON.parse(row.set_json) : row.set_json
  ) as Record<string, unknown>;
  const unset = (
    typeof row.unset_cols === "string"
      ? JSON.parse(row.unset_cols)
      : row.unset_cols
  ) as string[];

  // Spec §3.3: pk为空或缺失 → 跳过，触发 INVALID_PK
  if (!pk || Object.keys(pk).length === 0) return null;

  return {
    table: row.table_name,
    pk,
    op: row.op as RowOp["op"],
    set,
    unset: Array.isArray(unset) ? unset : [],
    where: null,
    row_count: 1,
    tags: [],
  };
}

// Merge warning arrays from multiple sources, sum counts per code, sort by code
function mergeWarnings(arrays: DBDiffWarning[][]): DBDiffWarning[] {
  const counts: Partial<Record<DBDiffWarning["code"], number>> = {};
  for (const warnings of arrays) {
    for (const { code, count } of warnings) {
      counts[code] = (counts[code] ?? 0) + count;
    }
  }
  return (Object.keys(counts) as DBDiffWarning["code"][])
    .sort()
    .map((code) => ({ code, count: counts[code]! }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { from, to, config, request_id } = body as {
      from: number;
      to: number;
      config?: CanonicalizeCfg;
      request_id?: string;
    };

    if (typeof from !== "number" || typeof to !== "number") {
      return NextResponse.json(
        { error: "from and to must be numbers" },
        { status: 400 },
      );
    }

    // Query audit rows in the range (from, to]
    let auditRows: AuditRow[];
    if (request_id) {
      auditRows = await prisma.$queryRaw<AuditRow[]>`
        SELECT audit_id, ts_ms, table_name, op, pk_json, set_json, unset_cols,
               request_id, txn_id, actor
        FROM db_write_audit
        WHERE audit_id > ${BigInt(from)}
          AND audit_id <= ${BigInt(to)}
          AND request_id = ${request_id}
        ORDER BY audit_id ASC
      `;
    } else {
      auditRows = await prisma.$queryRaw<AuditRow[]>`
        SELECT audit_id, ts_ms, table_name, op, pk_json, set_json, unset_cols,
               request_id, txn_id, actor
        FROM db_write_audit
        WHERE audit_id > ${BigInt(from)}
          AND audit_id <= ${BigInt(to)}
        ORDER BY audit_id ASC
      `;
    }

    // Convert audit rows to RowOps; track INVALID_PK
    let invalidPkCount = 0;
    const ops: RowOp[] = [];
    for (const row of auditRows) {
      const rowOp = toRowOp(row);
      if (rowOp === null) {
        invalidPkCount++;
      } else {
        ops.push(rowOp);
      }
    }

    const tsMs = auditRows.length > 0 ? Number(auditRows[0].ts_ms) : Date.now();

    const rawDiff: DBDiff = {
      schema: "dbdiff.v1",
      db: { dialect: "postgresql" },
      meta: {
        source_tool: "nexus-chat/dbdiff",
        request_id: request_id,
        ts_ms: tsMs,
      },
      ops,
    };

    // Merge caller-supplied noiseCols on top of the defaults
    const cfg: CanonicalizeCfg = {
      ...config,
      noiseCols: [
        ...DEFAULT_NOISE_COLS,
        ...(config?.noiseCols ?? []),
      ],
    };

    // canonicalizeDiff returns warnings from INVALID_OP_SEQUENCE, NULL_IN_SET, PARSE_FAILED
    const canonical = canonicalizeDiff(rawDiff, cfg);

    // Merge route-level warnings (INVALID_PK) with canonicalization warnings
    const routeWarnings: DBDiffWarning[] = [];
    if (invalidPkCount > 0) {
      routeWarnings.push({ code: "INVALID_PK", count: invalidPkCount });
    }
    const allWarnings = mergeWarnings([routeWarnings, canonical.meta.warnings ?? []]);

    // Attach effective noise_config and final warnings to canonical.meta
    const canonicalWithMeta: typeof canonical = {
      ...canonical,
      meta: {
        ...canonical.meta,
        noise_config: {
          noiseCols: cfg.noiseCols,
          noiseColsByTable: cfg.noiseColsByTable,
        },
        warnings: allWarnings,
      },
    };

    const exact_hash = hashDiff(canonicalWithMeta);

    return NextResponse.json({
      diff: rawDiff,
      canonical: canonicalWithMeta,
      exact_hash,
      debug: {
        audit_rows: auditRows.map((r) => ({
          ...r,
          audit_id: Number(r.audit_id),
          ts_ms: Number(r.ts_ms),
        })),
        ops_before_merge: ops.length,
        ops_after_merge: canonical.ops.length,
        effective_noise_cols: cfg.noiseCols,
        effective_noise_cols_by_table: cfg.noiseColsByTable ?? {},
      },
    });
  } catch (err) {
    console.error("[dbdiff/compute] error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
