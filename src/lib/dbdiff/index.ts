// =====================================================
// DBDiff v1 — public API re-exports
// =====================================================

export type { RowOp, DBDiff, CanonicalizeCfg } from "./types";
export { stableStringify, sha256, hashDiff } from "./hash";
export { mergeOps } from "./merge";
export { canonicalizeDiff } from "./canonicalize";
export { runWithRequestId, getRequestId } from "./context";
export { auditDbWrite, MODEL_TABLE_MAP } from "./audit";
