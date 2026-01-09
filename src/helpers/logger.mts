import fs from "node:fs";

import type { Get } from "type-fest";

import { is, SINGLE } from "../index.mts";
import type { TContext } from "./context.mts";
import type { TBlackHole } from "./utilities.mts";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ReplacementLogger {
  // intentionally left empty
  // for use with declaration merging
}

export type GetLogger =
  Get<ReplacementLogger, "logger"> extends object ? Get<ReplacementLogger, "logger"> : ILogger;

export type LogStreamTarget = (message: string, data: object) => TBlackHole;

export type DigitalAlchemyLogger = {
  addTarget: (logger: GetLogger | LogStreamTarget) => void;
  /**
   * Create a new logger instance for a given context
   */
  context: (context: string | TContext) => ILogger;
  /**
   * Retrieve a reference to the base logger used to emit from
   */
  getBaseLogger: () => Record<
    keyof GetLogger,
    (context: TContext, ...data: Parameters<TLoggerFunction>) => void
  >;
  getPrettyFormat: () => boolean;
  /**
   * exposed for testing
   */
  prettyFormatMessage: (message: string) => string;
  /**
   * Modify the base logger
   *
   * Note: Extension still handles LOG_LEVEL logic
   */
  setBaseLogger: (base: GetLogger) => GetLogger;
  /**
   * Set the enabled/disabled state of the message pretty formatting logic
   */
  setPrettyFormat: (state: boolean) => boolean;
  /**
   * Logger instance of last resort
   */
  systemLogger: GetLogger;
  /**
   * exposed for testing
   */
  updateShouldLog: () => void;
};

export type TLoggerFunction =
  | ((message: string, ...arguments_: unknown[]) => void)
  | ((object: object, message?: string, ...arguments_: unknown[]) => void);

export interface ILogger {
  debug(...arguments_: Parameters<TLoggerFunction>): void;
  debug(message: string, ...arguments_: unknown[]): void;
  debug(object: object, message?: string, ...arguments_: unknown[]): void;
  error(...arguments_: Parameters<TLoggerFunction>): void;
  error(message: string, ...arguments_: unknown[]): void;
  error(object: object, message?: string, ...arguments_: unknown[]): void;
  fatal(...arguments_: Parameters<TLoggerFunction>): void;
  fatal(message: string, ...arguments_: unknown[]): void;
  fatal(object: object, message?: string, ...arguments_: unknown[]): void;
  info(...arguments_: Parameters<TLoggerFunction>): void;
  info(message: string, ...arguments_: unknown[]): void;
  info(object: object, message?: string, ...arguments_: unknown[]): void;
  trace(...arguments_: Parameters<TLoggerFunction>): void;
  trace(message: string, ...arguments_: unknown[]): void;
  trace(object: object, message?: string, ...arguments_: unknown[]): void;
  warn(...arguments_: Parameters<TLoggerFunction>): void;
  warn(message: string, ...arguments_: unknown[]): void;
  warn(object: object, message?: string, ...arguments_: unknown[]): void;
}
export type TConfigLogLevel = keyof ILogger | "silent";

export const METHOD_COLORS = new Map<keyof ILogger, CONTEXT_COLORS>([
  ["trace", "grey"],
  ["debug", "blue"],
  ["warn", "yellow"],
  ["error", "red"],
  ["info", "green"],
  ["fatal", "magenta"],
]);
export type CONTEXT_COLORS = "grey" | "blue" | "yellow" | "red" | "green" | "magenta";
export const EVENT_UPDATE_LOG_LEVELS = "EVENT_UPDATE_LOG_LEVELS";

export function fatalLog(message: string, data?: unknown) {
  if (data) {
    if (data instanceof Error) {
      const cause = is.string(data?.cause) && !is.empty(data?.cause) ? ` - ${data.cause}` : "";
      const stack = data.stack ? `\n` + data.stack.split("\n").slice(SINGLE).join("\n") : ``;
      const errorOutput = `${data.name || "Error"}${cause}: ${data.message || "Unknown error"}${stack}`;
      message = [message, errorOutput].join("\n");
    } else {
      message = [message, JSON.stringify(data, undefined, "  ")].join("\n");
    }
  }
  fs.writeSync(process.stderr.fd, `${message}\n`);
}
