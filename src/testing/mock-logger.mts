import { ILogger } from "../index.mts";

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
