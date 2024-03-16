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
  trace: 10,
  warn: 40,
};

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

export async function Logger({ lifecycle, config, internal }: TServiceParams) {
  const chalk = (await import("chalk")).default;

  const YELLOW_DASH = chalk.yellowBright(frontDash);
  const BLUE_TICK = chalk.blue(`>`);

  const prettyFormatMessage = (message: string): string => {
    if (!message) {
      return ``;
    }
    if (message.length > MAX_CUTOFF) {
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

  [...METHOD_COLORS.keys()].forEach((key) => {
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

      const timestamp = chalk.white(`[${dayjs().format("ddd hh:mm:ss.SSS")}]`);
      let logMessage: string;
      if (!is.empty(parameters)) {
        const text = parameters.shift() as string;
        logMessage = format(prettyFormatMessage(text), ...parameters);
      }

      let message = `${timestamp} ${highlighted}`;
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
      if (["warn", "error", "log"].includes(key)) {
        // eslint-disable-next-line no-console
        console.error(message);
        return;
      }
      // eslint-disable-next-line no-console
      console.log(message);
    };
  });

  // if bootstrap hard coded something specific, then start there
  // otherwise, be noisy until config loads a user preference
  let logLevel: keyof ILogger =
    internal.utils.object.get(
      internal,
      "boot.options.configuration.boilerplate.LOG_LEVEL",
    ) || "trace";
  const shouldLog = (level: keyof ILogger) =>
    LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[logLevel];

  lifecycle.onPostConfig(() => (logLevel = config.boilerplate.LOG_LEVEL));

  function context(context: string | TContext) {
    return {
      debug: (...params: Parameters<TLoggerFunction>) =>
        shouldLog("debug") && logger.debug(context as TContext, ...params),
      error: (...params: Parameters<TLoggerFunction>) =>
        shouldLog("error") && logger.error(context as TContext, ...params),
      fatal: (...params: Parameters<TLoggerFunction>) =>
        shouldLog("fatal") && logger.fatal(context as TContext, ...params),
      info: (...params: Parameters<TLoggerFunction>) =>
        shouldLog("info") && logger.info(context as TContext, ...params),
      trace: (...params: Parameters<TLoggerFunction>) =>
        shouldLog("trace") && logger.trace(context as TContext, ...params),
      warn: (...params: Parameters<TLoggerFunction>) =>
        shouldLog("warn") && logger.warn(context as TContext, ...params),
    } as ILogger;
  }

  return {
    context,
    getBaseLogger: () => logger,
    getLogLevel: () => logLevel,
    setBaseLogger: (base: ILogger) => (logger = base),
    setLogLevel: (level: keyof ILogger) => {
      logLevel = level;
      internal.boilerplate.config.set("boilerplate", "LOG_LEVEL", level);
    },
    systemLogger: context("digital-alchemy:system-logger"),
  };
}
