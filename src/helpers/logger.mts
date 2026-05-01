/**
 * Logger interface and configuration — dual-arity log methods, color schemes,
 * and a last-resort stderr writer.
 *
 * @remarks
 * The logger supports six severity levels (trace, debug, info, warn, error, fatal)
 * and dual-arity calls: `logger.info("message")` or `logger.info({ context, id }, "message")`.
 * The logger service wraps this interface with chalk/stdout formatting, ALS
 * integration, and LOG_LEVEL filtering. `fatalLog` is the last-resort writer for
 * fatal conditions that cannot use the logger (e.g., during bootstrap failure).
 */

import fs from "node:fs";

import type { Get } from "type-fest";

import { is, SINGLE } from "../index.mts";
import type { TContext } from "./context.mts";
import type { TBlackHole } from "./utilities.mts";

/**
 * Extension hook for logger replacement via declaration merging.
 *
 * @remarks
 * Downstream libraries can extend this interface to substitute their own logger
 * type into `GetLogger`, allowing alternative logging implementations.
 *
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ReplacementLogger {
  // intentionally left empty
  // for use with declaration merging
}

/**
 * Resolved logger type — either a merged replacement logger or the default `ILogger`.
 *
 * @remarks
 * When `ReplacementLogger` is extended with a `logger` property, that type is
 * used; otherwise, `ILogger` is the default.
 */
export type GetLogger =
  Get<ReplacementLogger, "logger"> extends object ? Get<ReplacementLogger, "logger"> : ILogger;

/**
 * Streaming log target — a function that receives formatted message and context data.
 *
 * @remarks
 * Implementing libraries can add custom targets to send logs to external services
 * (e.g., Datadog, CloudWatch) via the `logger.addTarget(...)` method.
 */
export type LogStreamTarget = (message: string, data: object) => TBlackHole;

/**
 * Logger service interface — methods to emit logs, create scoped loggers, and
 * configure targets and output formatting.
 *
 * @remarks
 * Each method operates on a base logger (which can be replaced for testing or
 * integration) and filters based on the current LOG_LEVEL configuration.
 * The `systemLogger` is a pre-created instance for use in bootstrap and
 * low-level operations.
 */
export type DigitalAlchemyLogger = {
  /**
   * Register an additional log target.
   *
   * @remarks
   * Targets receive all logged messages and context data after filtering.
   * Can be a logger instance (like `ILogger`) or a stream function that writes
   * directly to an external service.
   */
  addTarget: (logger: GetLogger | LogStreamTarget) => void;

  /**
   * Create a new logger instance scoped to a specific context.
   *
   * @remarks
   * Returns an `ILogger` where all calls are implicitly tagged with the given context,
   * enabling per-request log correlation and filtering.
   */
  context: (context: string | TContext) => ILogger;

  /**
   * Retrieve the underlying base logger implementation.
   *
   * @remarks
   * Exposed for testing and low-level integrations; most code should use the logger
   * returned by the injection, not this method.
   *
   * @internal
   */
  getBaseLogger: () => Record<
    keyof GetLogger,
    (context: TContext, ...data: Parameters<TLoggerFunction>) => void
  >;

  /**
   * Check whether pretty formatting is enabled.
   *
   * @remarks
   * Exposed for testing.
   *
   * @internal
   */
  getPrettyFormat: () => boolean;

  /**
   * Format a message string for display.
   *
   * @remarks
   * Applies syntax highlighting or other transformations based on the current
   * pretty-format setting. Exposed for testing.
   *
   * @internal
   */
  prettyFormatMessage: (message: string) => string;

  /**
   * Replace the base logger implementation.
   *
   * @remarks
   * Allows testing and framework integration by substituting a mock or wrapper logger.
   * The service still enforces LOG_LEVEL filtering on top of the replacement.
   */
  setBaseLogger: (base: GetLogger) => GetLogger;

  /**
   * Enable or disable pretty formatting of log messages.
   *
   * @remarks
   * When disabled, output is minimal (no colors, no extra formatting).
   * Returns the new state.
   */
  setPrettyFormat: (state: boolean) => boolean;

  /**
   * System logger instance — ready-to-use logger for bootstrap and low-level code.
   *
   * @remarks
   * Pre-created for convenience in places where context is unavailable or
   * not yet initialized.
   */
  systemLogger: GetLogger;

  /**
   * Recompute log filtering based on current LOG_LEVEL config.
   *
   * @remarks
   * Call after changing the LOG_LEVEL configuration to update filter state.
   * Exposed for testing.
   *
   * @internal
   */
  updateShouldLog: () => void;
};

/**
 * Dual-arity logger function signature — message-only or object+message forms.
 *
 * @remarks
 * Enables flexible calling styles:
 * - `logger.info("message")`
 * - `logger.info({data}, "message")`
 * The logger extracts `name` from objects for call-site identification.
 */
export type TLoggerFunction =
  | ((message: string, ...arguments_: unknown[]) => void)
  | ((object: object, message?: string, ...arguments_: unknown[]) => void);

/**
 * Logger interface — six severity levels with dual-arity overloads.
 *
 * @remarks
 * Each level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) accepts either
 * a message string or an object with metadata plus an optional message. The
 * object form typically includes a `name` field (function reference) for
 * call-site identification.
 */
export interface ILogger {
  /**
   * Log at TRACE level — lowest severity, highest volume; decision points, entry/exit.
   */
  trace(...arguments_: Parameters<TLoggerFunction>): void;
  trace(message: string, ...arguments_: unknown[]): void;
  trace(object: object, message?: string, ...arguments_: unknown[]): void;

  /**
   * Log at DEBUG level — low severity; detailed operation flow.
   */
  debug(...arguments_: Parameters<TLoggerFunction>): void;
  debug(message: string, ...arguments_: unknown[]): void;
  debug(object: object, message?: string, ...arguments_: unknown[]): void;

  /**
   * Log at INFO level — notable events; startup, shutdown, config changes.
   */
  info(...arguments_: Parameters<TLoggerFunction>): void;
  info(message: string, ...arguments_: unknown[]): void;
  info(object: object, message?: string, ...arguments_: unknown[]): void;

  /**
   * Log at WARN level — unexpected but non-fatal; potential issues worth investigating.
   */
  warn(...arguments_: Parameters<TLoggerFunction>): void;
  warn(message: string, ...arguments_: unknown[]): void;
  warn(object: object, message?: string, ...arguments_: unknown[]): void;

  /**
   * Log at ERROR level — error conditions; failed operations, exceptions.
   */
  error(...arguments_: Parameters<TLoggerFunction>): void;
  error(message: string, ...arguments_: unknown[]): void;
  error(object: object, message?: string, ...arguments_: unknown[]): void;

  /**
   * Log at FATAL level — unrecoverable errors; application must shut down.
   */
  fatal(...arguments_: Parameters<TLoggerFunction>): void;
  fatal(message: string, ...arguments_: unknown[]): void;
  fatal(object: object, message?: string, ...arguments_: unknown[]): void;
}

/**
 * Configuration value type — log level or the special "silent" value.
 */
export type TConfigLogLevel = keyof ILogger | "silent";

/**
 * Mapping from log level to console color for pretty-printed output.
 */
export const METHOD_COLORS = new Map<keyof ILogger, CONTEXT_COLORS>([
  ["trace", "grey"],
  ["debug", "blue"],
  ["info", "green"],
  ["warn", "yellow"],
  ["error", "red"],
  ["fatal", "magenta"],
]);

/**
 * Supported console color names for log output.
 */
export type CONTEXT_COLORS = "grey" | "blue" | "yellow" | "red" | "green" | "magenta";

/**
 * Event name for log level configuration updates.
 *
 * @internal
 */
export const EVENT_UPDATE_LOG_LEVELS = "EVENT_UPDATE_LOG_LEVELS";

/**
 * Last-resort logger for fatal conditions that cannot use the normal logger.
 *
 * @remarks
 * Writes directly to `stderr` bypassing the logger service. Use only when the
 * logger is not available (e.g., during bootstrap failure before services are
 * wired). If `data` is an Error, extracts and formats `name`, `cause`, `message`,
 * and stack trace; otherwise, JSON-stringifies it. Always adds a trailing newline.
 *
 * @example
 * ```typescript
 * try {
 *   await bootstrap();
 * } catch (error) {
 *   fatalLog("bootstrap failed", error);
 *   process.exit(1);
 * }
 * ```
 */
export function fatalLog(message: string, data?: unknown) {
  if (data) {
    if (data instanceof Error) {
      // extract structured error fields with fallback defaults
      const cause = is.string(data?.cause) && !is.empty(data?.cause) ? ` - ${data.cause}` : "";
      const stack = data.stack ? `\n` + data.stack.split("\n").slice(SINGLE).join("\n") : ``;
      const errorOutput = `${data.name || "Error"}${cause}: ${data.message || "Unknown error"}${stack}`;
      message = [message, errorOutput].join("\n");
    } else {
      // pretty-print non-error data
      message = [message, JSON.stringify(data, undefined, "  ")].join("\n");
    }
  }
  fs.writeSync(process.stderr.fd, `${message}\n`);
}
