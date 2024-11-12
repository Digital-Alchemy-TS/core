import { ILogger } from "../index.mjs";

export function createMockLogger(): ILogger {
  return {
    debug: () => {},
    error: () => {},
    fatal: () => {},
    info: () => {},
    trace: () => {},
    warn: () => {},
  };
}
