// =====================================================
// DBDiff v1 TypeScript Types
// =====================================================

export interface RowOp {
  table: string;
  pk: Record<string, unknown>;
  op: "INSERT" | "UPDATE" | "DELETE" | "UPSERT";
  set: Record<string, unknown>;
  unset: string[];
  where: null;
  row_count: 1;
  tags: string[];
}

export interface DBDiffWarning {
  code:
    | "AUDIT_WRITE_FAILED"
    | "INVALID_OP_SEQUENCE"
    | "INVALID_PK"
    | "NULL_IN_SET"
    | "PARSE_FAILED";
  count: number;
}

export interface NoiseConfig {
  noiseCols?: string[];
  noiseColsByTable?: Record<string, string[]>;
}

export interface DBDiff {
  schema: "dbdiff.v1";
  db: { dialect: string; name?: string };
  meta: {
    source_tool: string;
    request_id?: string;
    txn_id?: string;
    ts_ms: number;
    noise_config?: NoiseConfig;
    warnings?: DBDiffWarning[];
  };
  ops: RowOp[];
}

export interface CanonicalizeCfg {
  /** Columns to remove from set/unset for ALL tables, e.g. ['createdAt', 'updatedAt'] */
  noiseCols?: string[];
  /** Additional columns to remove per table, e.g. { users: ['passwordHash'] } */
  noiseColsByTable?: Record<string, string[]>;
}
