// =====================================================
// Canonicalize a DBDiff: Step 1-5 per DBDiff v1 spec
// =====================================================

import type { DBDiff, DBDiffWarning, RowOp, CanonicalizeCfg } from "./types";
import { mergeOps } from "./merge";
import { stableStringify } from "./hash";

// v1 allowed tag values — anything else is stripped in Step 5
const V1_ALLOWED_TAGS = new Set(["from_delete_insert"]);

// RFC 3339 with mandatory T separator and explicit timezone (Z or ±HH:MM)
// e.g. 2024-01-15T12:30:00.000Z   2024-01-15T12:30:00+08:00
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

interface WarnCtx {
  parseFailedCount: number;
  nullInSetCount: number;
}

// Step 2-②③: datetime normalization + recursive object key sort
function normalizeValue(v: unknown, ctx: WarnCtx): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    if (RFC3339_RE.test(v)) {
      const ms = Date.parse(v);
      if (!isNaN(ms)) return ms;
      ctx.parseFailedCount++;
    }
    return v;
  }
  if (Array.isArray(v)) return v.map((item) => normalizeValue(item, ctx));
  if (typeof v === "object") {
    const result: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      result[k] = normalizeValue((v as Record<string, unknown>)[k], ctx);
    }
    return result;
  }
  return v;
}

// Step 2: ① NULL normalization → ② datetime → ③ key sort
function normalizeOp(op: RowOp, ctx: WarnCtx): RowOp {
  // 2-①: set[k] === null → remove from set, add to unset (case-sensitive key match)
  const setAfterNull: Record<string, unknown> = {};
  const nullKeys: string[] = [];
  for (const [k, v] of Object.entries(op.set)) {
    if (v === null) {
      nullKeys.push(k);
      ctx.nullInSetCount++;
    } else {
      setAfterNull[k] = v;
    }
  }
  const unsetAfterNull = [...new Set([...op.unset, ...nullKeys])];

  // 2-②③: datetime normalization + recursive key sort
  const finalSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(setAfterNull)) {
    finalSet[k] = normalizeValue(v, ctx);
  }

  return {
    ...op,
    pk: normalizeValue(op.pk, ctx) as Record<string, unknown>,
    set: finalSet,
    unset: unsetAfterNull,
  };
}

function removeNoiseCols(
  set: Record<string, unknown>,
  unset: string[],
  noiseCols: string[],
): { set: Record<string, unknown>; unset: string[] } {
  const noiseSet = new Set(noiseCols);
  const filteredSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(set)) {
    if (!noiseSet.has(k)) filteredSet[k] = v;
  }
  return { set: filteredSet, unset: unset.filter((c) => !noiseSet.has(c)) };
}

function isNoOp(op: RowOp): boolean {
  if (op.op === "DELETE") return false;
  return Object.keys(op.set).length === 0 && op.unset.length === 0;
}

// Build sorted {code, count} warning array, omitting zero-count entries
function buildWarnings(counts: Partial<Record<DBDiffWarning["code"], number>>): DBDiffWarning[] {
  return (Object.keys(counts) as DBDiffWarning["code"][])
    .filter((k) => (counts[k] ?? 0) > 0)
    .sort()
    .map((code) => ({ code, count: counts[code]! }));
}

export function canonicalizeDiff(diff: DBDiff, cfg: CanonicalizeCfg = {}): DBDiff {
  const globalNoise = cfg.noiseCols ?? [];
  const noiseByTable = cfg.noiseColsByTable ?? {};
  const ctx: WarnCtx = { parseFailedCount: 0, nullInSetCount: 0 };

  // Step 1: Remove noise columns (global + per-table); pk never filtered
  let ops = diff.ops.map((op) => {
    const noiseCols = [...globalNoise, ...(noiseByTable[op.table] ?? [])];
    const { set, unset } = removeNoiseCols(op.set, op.unset, noiseCols);
    return { ...op, set, unset };
  });

  // Step 2: Normalize values (NULL first, then datetime + key sort)
  ops = ops.map((op) => normalizeOp(op, ctx));

  // Step 3: Merge ops by (table, pk) using the full 4×4 state machine
  const { ops: mergedOps, warnings: mergeWarnings } = mergeOps(ops);
  ops = mergedOps;

  // Step 4: Remove no-ops (non-DELETE with empty set and unset)
  ops = ops.filter((op) => !isNoOp(op));

  // Step 5: ① strip non-v1 tags → ② sort unset/tags per op → ③ sort all ops
  ops = ops
    .map((op) => ({
      ...op,
      tags: op.tags.filter((t) => V1_ALLOWED_TAGS.has(t)).sort(),
      unset: [...op.unset].sort(),
    }))
    .sort((a, b) => {
      const ta = a.table.localeCompare(b.table);
      if (ta !== 0) return ta;
      const pa = stableStringify(a.pk).localeCompare(stableStringify(b.pk));
      if (pa !== 0) return pa;
      return a.op.localeCompare(b.op);
    });

  // Collect warnings from this canonicalization pass
  const warnings = buildWarnings({
    INVALID_OP_SEQUENCE: mergeWarnings.invalidOpSequenceCount,
    NULL_IN_SET: ctx.nullInSetCount,
    PARSE_FAILED: ctx.parseFailedCount,
  });

  return {
    ...diff,
    ops,
    meta: { ...diff.meta, warnings },
  };
}
