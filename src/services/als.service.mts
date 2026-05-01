import { AsyncLocalStorage } from "node:async_hooks";

import type { AlsExtension, AsyncLocalData, AsyncLogData, TBlackHole } from "../index.mts";

/**
 * AsyncLocalStorage wrapper for request-scoped context propagation.
 *
 * @remarks
 * Creates and owns a single AsyncLocalStorage instance that holds
 * request-scoped data across async boundaries. Provides methods to enter
 * context, retrieve store, and run callbacks within a specific data context.
 * The logger uses this to merge per-request fields into every log line
 * without explicit parameter passing through the call chain.
 */
export function ALS(): AlsExtension {
  const storage = new AsyncLocalStorage<AsyncLocalData>();
  return {
    /**
     * Retrieve the internal AsyncLocalStorage instance.
     */
    asyncStorage: () => storage,
    /**
     * Enter context with data; data persists for synchronously-executed callbacks.
     *
     * @remarks
     * Sets the async local context to the provided data object. All code running
     * on the same async task will see this data when calling `getStore()`.
     * Unlike `run()`, this does not execute a callback; the context persists
     * until changed by another `enterWith()` or cleared by the async context.
     */
    enterWith(data) {
      // establish context for the current async task
      storage.enterWith(data);
    },
    /**
     * Extract log-scoped fields from current context.
     *
     * @remarks
     * Retrieves the `logs` sub-object from the async local store, defaulting to
     * an empty object if no context is set. Used by logger to inject context
     * fields into every log entry automatically without requiring per-call passing.
     */
    getLogData: () => storage.getStore()?.logs ?? ({} as AsyncLogData),
    /**
     * Retrieve the full async local store.
     *
     * @remarks
     * Returns the complete data object set by `enterWith()` or `run()`, or
     * undefined if no context is active. The returned object is read-only to
     * callers; mutation must go through `enterWith()` or `run()`.
     */
    getStore: () => storage.getStore(),
    /**
     * Execute a callback within a specific data context.
     *
     * @remarks
     * Runs the callback with the provided data visible to `getStore()` for the
     * duration of the callback and all async operations it spawns. The context
     * is automatically cleared when the callback completes (or earlier if an
     * async boundary is crossed outside the callback).
     */
    run(data: AsyncLocalData, callback: () => TBlackHole) {
      // wrap the callback to establish and maintain context for its duration
      storage.run(data, () => {
        callback();
      });
    },
  };
}
