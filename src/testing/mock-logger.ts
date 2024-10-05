import { ILogger } from "../helpers";

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
