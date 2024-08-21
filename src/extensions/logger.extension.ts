import dayjs from "dayjs";
import { format, inspect } from "util";

import { FIRST, is, START, TContext } from "..";
import { TServiceParams } from "..";

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

const LOG_LEVEL_PRIORITY = {
  debug: 20,
  error: 50,
  fatal: 60,
  info: 30,
  silent: 100,
  trace: 10,
  warn: 40,
};
const LOG_LEVELS = Object.keys(LOG_LEVEL_PRIORITY) as TConfigLogLevel[];

export type TConfigLogLevel = keyof ILogger | "silent";

export const METHOD_COLORS = new Map<keyof ILogger, CONTEXT_COLORS>([
  ["trace", "grey"],
  ["debug", "blue"],
  ["warn", "yellow"],
  ["error", "red"],
  ["info", "green"],
  ["fatal", "magenta"],
]);

let logger = {} as Record<
  keyof ILogger,
  (context: TContext, ...data: Parameters<TLoggerFunction>) => void
>;

export type CONTEXT_COLORS =
  | "grey"
  | "blue"
  | "yellow"
  | "red"
  | "green"
  | "magenta";
const MAX_CUTOFF = 2000;
const frontDash = " - ";
const SYMBOL_START = 1;
const SYMBOL_END = -1;
const LEVEL_MAX = 7;

// #region Service definition
export async function Logger({ lifecycle, config, internal }: TServiceParams) {
  const chalk = (await import("chalk")).default;

  const YELLOW_DASH = chalk.yellowBright(frontDash);
  const BLUE_TICK = chalk.blue(`>`);
  let prettyFormat = true;
  const shouldILog = {} as Record<TConfigLogLevel, boolean>;

  // #MARK: pretty logger
  const prettyFormatMessage = (message: string): string => {
    if (!message) {
      return ``;
    }
    if (message.length > MAX_CUTOFF || !prettyFormat) {
      return message;
    }
    message = message
      // ? partA#partB - highlight it all in yellow
      .replaceAll(new RegExp("([^ ]+#[^ ]+)", "g"), (i) => chalk.yellow(i))
      // ? [A] > [B] > [C] - highlight the >'s in blue
      .replaceAll("] > [", `] ${BLUE_TICK} [`)
      // ? [Text] - strip brackets, highlight magenta
      .replaceAll(new RegExp("(\\[[^\\]\\[]+\\])", "g"), (i) =>
        chalk.bold.magenta(i.slice(SYMBOL_START, SYMBOL_END)),
      )
      // ? {Text} - strip braces, highlight gray
      .replaceAll(new RegExp("(\\{[^\\]}]+\\})", "g"), (i) =>
        chalk.bold.gray(i.slice(SYMBOL_START, SYMBOL_END)),
      );
    // ? " - Text" (line prefix with dash) - highlight dash
    if (message.slice(START, frontDash.length) === frontDash) {
      message = `${YELLOW_DASH}${message.slice(frontDash.length)}`;
    }
    return message;
  };

  if (is.empty(internal.boot.options.customLogger)) {
    // #region formatter
    [...METHOD_COLORS.keys()].forEach((key) => {
      const level = `[${key.toUpperCase()}]`.padStart(LEVEL_MAX, " ");
      logger[key] = (
        context: TContext,
        ...parameters: Parameters<TLoggerFunction>
      ) => {
        const data = is.object(parameters[FIRST])
          ? (parameters.shift() as {
              context?: TContext;
              error?: Error | string;
              name?: string | { name: string };
              stack?: string | string[];
            })
          : {};
        const highlighted = chalk.bold[METHOD_COLORS.get(key)](
          `[${data.context || context}]`,
        );
        const name =
          is.object(data.name) || is.function(data.name)
            ? data.name.name
            : data.name;
        delete data.context;
        delete data.name;

        const timestamp = chalk.white(
          `[${dayjs().format("ddd hh:mm:ss.SSS")}]`,
        );
        let logMessage: string;
        if (!is.empty(parameters)) {
          const text = parameters.shift() as string;
          logMessage = format(prettyFormatMessage(text), ...parameters);
        }

        let message = `${timestamp} ${level}${highlighted}`;

        if (!is.empty(name)) {
          message += chalk.blue(` (${name})`);
        }
        if (!is.empty(logMessage)) {
          message += `: ${chalk.cyan(logMessage)}`;
        }
        if (!is.empty(data)) {
          message +=
            "\n" +
            inspect(data, {
              colors: true,
              compact: false,
              depth: 10,
              numericSeparator: true,
              sorted: true,
            })
              .split("\n")
              .slice(SYMBOL_START, SYMBOL_END)
              .join("\n");
        }
        if (["warn", "error", "fatal"].includes(key)) {
          // eslint-disable-next-line no-console
          console.error(message);
          return;
        }
        // eslint-disable-next-line no-console
        console.log(message);
      };
    });
    // #endregion
  } else {
    logger = internal.boot.options.customLogger;
  }

  // #region instance creation
  // if bootstrap hard coded something specific, then start there
  // otherwise, be noisy until config loads a user preference
  //
  // stored as separate variable to cut down on internal config lookups
  let CURRENT_LOG_LEVEL: TConfigLogLevel =
    internal.utils.object.get(
      internal,
      "boot.options.configuration.boilerplate.LOG_LEVEL",
    ) || "trace";

  function context(context: string | TContext) {
    return {
      debug: (...params: Parameters<TLoggerFunction>) =>
        shouldILog.debug && logger.debug(context as TContext, ...params),
      error: (...params: Parameters<TLoggerFunction>) =>
        shouldILog.error && logger.error(context as TContext, ...params),
      fatal: (...params: Parameters<TLoggerFunction>) =>
        shouldILog.fatal && logger.fatal(context as TContext, ...params),
      info: (...params: Parameters<TLoggerFunction>) =>
        shouldILog.info && logger.info(context as TContext, ...params),
      trace: (...params: Parameters<TLoggerFunction>) =>
        shouldILog.trace && logger.trace(context as TContext, ...params),
      warn: (...params: Parameters<TLoggerFunction>) =>
        shouldILog.warn && logger.warn(context as TContext, ...params),
    } as ILogger;
  }

  const updateShouldLog = () => {
    if (!is.empty(config.boilerplate.LOG_LEVEL)) {
      CURRENT_LOG_LEVEL = config.boilerplate.LOG_LEVEL;
    }
    LOG_LEVELS.forEach((key: TConfigLogLevel) => {
      shouldILog[key] =
        LOG_LEVEL_PRIORITY[key] >= LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL];
    });
  };

  // #MARK: lifecycle
  lifecycle.onPostConfig(() => internal.boilerplate.logger.updateShouldLog());
  internal.boilerplate.configuration.onUpdate(
    () => internal.boilerplate.logger.updateShouldLog(),
    "boilerplate",
    "LOG_LEVEL",
  );
  updateShouldLog();

  // #MARK: return object
  return {
    /**
     * Create a new logger instance for a given context
     */
    context,

    /**
     * Retrieve a reference to the base logger used to emit from
     */
    getBaseLogger: () => logger,

    /**
     * for testing
     */
    getShouldILog: () => ({ ...shouldILog }),

    /**
     * exposed for testing
     */
    prettyFormatMessage,

    /**
     * Modify the base logger
     *
     * Note: Extension still handles LOG_LEVEL logic
     */
    setBaseLogger: (base: ILogger) => (logger = base),

    /**
     * Set the enabled/disabled state of the message pretty formatting logic
     */
    setPrettyFormat: (state: boolean) => (prettyFormat = state),

    /**
     * Logger instance of last resort
     */
    systemLogger: context("digital-alchemy:system-logger"),

    /**
     * exposed for testing
     */
    updateShouldLog,
  };
}
// #endregion
