// =====================================================
// POST /api/dbdiff/snapshot
// Returns { snapshot_id: number } — the current max audit_id
// =====================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const rows = await prisma.$queryRaw<[{ max_id: bigint | null }]>`
      SELECT COALESCE(MAX(audit_id), 0)::bigint AS max_id FROM db_write_audit
    `;
    const snapshotId = Number(rows[0].max_id ?? 0);
    return NextResponse.json({ snapshot_id: snapshotId });
  } catch (err) {
    console.error("[dbdiff/snapshot] error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
