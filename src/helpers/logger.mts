import type { TContext } from "./context.mts";
import type { TBlackHole } from "./utilities.mts";

export type LogStreamTarget = (message: string, data: object) => TBlackHole;

export type DigitalAlchemyLogger = {
  addTarget: (logger: LogStreamTarget) => void;
  /**
   * Create a new logger instance for a given context
   */
  context: (context: string | TContext) => ILogger;
  /**
   * Retrieve a reference to the base logger used to emit from
   */
  getBaseLogger: () => ILogger;
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
  setBaseLogger: (base: ILogger) => ILogger;
  /**
   * Set the enabled/disabled state of the message pretty formatting logic
   */
  setPrettyFormat: (state: boolean) => boolean;
  /**
   * Logger instance of last resort
   */
  systemLogger: ILogger;
  /**
   * exposed for testing
   */
  updateShouldLog: () => void;
};

export interface ExtraLoggerArgs {
  string: string;
  boolean: boolean;
  number: number;
}

export type LoggerArgs = ExtraLoggerArgs[keyof ExtraLoggerArgs];

export type TLoggerFunction =
  | ((message: string, ...arguments_: LoggerArgs[]) => void)
  | ((object: object, message?: string, ...arguments_: LoggerArgs[]) => void);

// export type InternalRewriteLoggerFn = (
//   context: TContext,
//   ...data: Parameters<TLoggerFunction>
// ) => void;

// export type InternalRewriteLogger = Record<keyof ILogger, InternalRewriteLoggerFn>;

export interface ILogger {
  debug(...arguments_: Parameters<TLoggerFunction>): void;
  debug(message: string, ...arguments_: LoggerArgs[]): void;
  debug(object: object, message?: string, ...arguments_: LoggerArgs[]): void;
  error(...arguments_: Parameters<TLoggerFunction>): void;
  error(message: string, ...arguments_: LoggerArgs[]): void;
  error(object: object, message?: string, ...arguments_: LoggerArgs[]): void;
  fatal(...arguments_: Parameters<TLoggerFunction>): void;
  fatal(message: string, ...arguments_: LoggerArgs[]): void;
  fatal(object: object, message?: string, ...arguments_: LoggerArgs[]): void;
  info(...arguments_: Parameters<TLoggerFunction>): void;
  info(message: string, ...arguments_: LoggerArgs[]): void;
  info(object: object, message?: string, ...arguments_: LoggerArgs[]): void;
  trace(...arguments_: Parameters<TLoggerFunction>): void;
  trace(message: string, ...arguments_: LoggerArgs[]): void;
  trace(object: object, message?: string, ...arguments_: LoggerArgs[]): void;
  warn(...arguments_: Parameters<TLoggerFunction>): void;
  warn(message: string, ...arguments_: LoggerArgs[]): void;
  warn(object: object, message?: string, ...arguments_: LoggerArgs[]): void;
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
