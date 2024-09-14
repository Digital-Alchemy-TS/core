import { ILogger } from "../extensions";

export function createMockLogger(): ILogger {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    info: jest.fn(),
    trace: jest.fn(),
    warn: jest.fn(),
  };
}
