import type { ILogger } from "../index.mts";

/**
 * Create a no-op logger for suppressing output in test specs.
 *
 * @remarks
 * Returns an {@link ILogger} where every method is a stub function that discards
 * all input. Use this in test runners or specs where logger output would pollute
 * test output or stderr during a silent test run.
 */
export function createMockLogger(): ILogger {
  // every method is a stub to avoid any side effects during testing
  return {
    debug: () => {},
    error: () => {},
    fatal: () => {},
    info: () => {},
    trace: () => {},
    warn: () => {},
  };
}
