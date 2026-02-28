// =====================================================
// Deterministic JSON serialization + SHA256 hash
// =====================================================

import { createHash } from "crypto";
import type { DBDiff } from "./types";

/** Recursively sort object keys for deterministic serialization. */
export function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return JSON.stringify(v);
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) {
    return "[" + v.map(stableStringify).join(",") + "]";
  }
  const sorted = Object.keys(v as object)
    .sort()
    .map((k) => {
      return (
        JSON.stringify(k) + ":" + stableStringify((v as Record<string, unknown>)[k])
      );
    });
  return "{" + sorted.join(",") + "}";
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function hashDiff(canonical: DBDiff): string {
  // Per spec §7: only {schema, db, ops} participate in exact_hash; meta is excluded.
  const hashInput: { schema: string; db: DBDiff["db"]; ops: DBDiff["ops"] } = {
    schema: canonical.schema,
    db: canonical.db,
    ops: canonical.ops,
  };
  return sha256(stableStringify(hashInput));
}
