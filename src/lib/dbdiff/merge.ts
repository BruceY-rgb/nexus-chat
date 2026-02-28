// =====================================================
// Merge RowOps: full 4×4 state machine — DBDiff v1 spec §5 Step 3
// =====================================================

import type { RowOp } from "./types";
import { stableStringify } from "./hash";

type Op = RowOp["op"];
type MergeKey = string;

// State machine: MERGE_OP[currentOp][incomingOp] = resultOp
// Missing key means the transition is invalid → Ignore (INVALID_OP_SEQUENCE)
const MERGE_OP: Record<Op, Partial<Record<Op, Op>>> = {
  INSERT: { UPDATE: "INSERT", DELETE: "DELETE", UPSERT: "INSERT" },
  UPDATE: { UPDATE: "UPDATE", DELETE: "DELETE", UPSERT: "UPDATE" },
  DELETE: { INSERT: "UPSERT", UPSERT: "UPSERT" },
  UPSERT: { UPDATE: "UPSERT", DELETE: "DELETE", UPSERT: "UPSERT" },
};

// Spec §5 Step 3 footnote ²: merged_set = {...current, ...incoming}
// merged_unset = union(current.unset, incoming.unset) minus keys in merged_set
function mergeSet(
  current: RowOp,
  incoming: RowOp,
): { set: Record<string, unknown>; unset: string[] } {
  const mergedSet = { ...current.set, ...incoming.set };
  const mergedUnset = [...new Set([...current.unset, ...incoming.unset])].filter(
    (c) => !(c in mergedSet),
  );
  return { set: mergedSet, unset: mergedUnset };
}

function makeKey(op: RowOp): MergeKey {
  return stableStringify({ table: op.table, pk: op.pk });
}

export interface MergeWarnings {
  invalidOpSequenceCount: number;
}

export function mergeOps(ops: RowOp[]): { ops: RowOp[]; warnings: MergeWarnings } {
  const order: MergeKey[] = [];
  const merged = new Map<MergeKey, RowOp>();
  let invalidOpSequenceCount = 0;

  for (const incoming of ops) {
    const key = makeKey(incoming);

    if (!merged.has(key)) {
      order.push(key);
      merged.set(key, incoming);
      continue;
    }

    const current = merged.get(key)!;
    const resultOp = MERGE_OP[current.op]?.[incoming.op];

    if (resultOp === undefined) {
      // Invalid transition: keep current state, increment warning counter
      invalidOpSequenceCount++;
      continue;
    }

    const fromDeleteToUpsert =
      current.op === "DELETE" &&
      (incoming.op === "INSERT" || incoming.op === "UPSERT");

    let newSet: Record<string, unknown>;
    let newUnset: string[];
    let newTags: string[];

    if (resultOp === "DELETE") {
      // DELETE result always clears set/unset; tags inherited from current
      newSet = {};
      newUnset = [];
      newTags = [...current.tags];
    } else if (fromDeleteToUpsert) {
      // DELETE→INSERT/UPSERT: use incoming's set/unset, add from_delete_insert tag
      newSet = { ...incoming.set };
      newUnset = [...incoming.unset];
      newTags = current.tags.includes("from_delete_insert")
        ? [...current.tags]
        : [...current.tags, "from_delete_insert"];
    } else {
      // All other valid merges: merge set/unset, inherit tags from current state only
      const { set, unset } = mergeSet(current, incoming);
      newSet = set;
      newUnset = unset;
      newTags = [...current.tags];
    }

    merged.set(key, {
      ...current,
      op: resultOp,
      set: newSet,
      unset: newUnset,
      tags: newTags,
    });
  }

  return {
    ops: order.map((k) => merged.get(k)!),
    warnings: { invalidOpSequenceCount },
  };
}
