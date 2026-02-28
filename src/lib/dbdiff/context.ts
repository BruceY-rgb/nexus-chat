// =====================================================
// AsyncLocalStorage for request_id propagation
// =====================================================

import { AsyncLocalStorage } from "async_hooks";

const store = new AsyncLocalStorage<{ requestId: string }>();

export const runWithRequestId = (
  id: string,
  fn: () => Promise<void>,
): Promise<void> => store.run({ requestId: id }, fn);

export const getRequestId = (): string | undefined =>
  store.getStore()?.requestId;
