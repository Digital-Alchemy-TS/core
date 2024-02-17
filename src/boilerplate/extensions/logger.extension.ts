/* eslint-disable @typescript-eslint/no-magic-numbers */
import { pino } from "pino";
import { inspect } from "util";

import { is, TContext, ZCC } from "../..";
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

let logger = pino(
  {
    level: "debug",
    transport: {
      options: {
        colorize: true,
        crlf: false,
        customPrettifiers: {},
        errorLikeObjectKeys: ["err", "error"],
        errorProps: "",
        hideObject: false,
        ignore: "pid,hostname,level",
        levelFirst: false,
        levelKey: "level",
        messageKey: "msg",
        singleLine: false,
        timestampKey: "time",
        translateTime: "SYS:ddd hh:MM:ss.l",
      },
      target: "pino-pretty",
    },
  },
  pino.destination({ sync: true }),
) as ILogger;

const LOG_LEVEL_PRIORITY = {
  debug: 20,
  error: 50,
  fatal: 60,
  info: 30,
  trace: 10,
  warn: 40,
};

export const METHOD_COLORS = new Map<pino.Level, CONTEXT_COLORS>([
  ["trace", "grey"],
  ["debug", "blue"],
  ["warn", "yellow"],
  ["error", "red"],
  ["info", "green"],
  ["fatal", "magenta"],
]);

// function standardLogger(
//   method: pino.Level,
//   context: string,
//   ...parameters: Parameters<TLoggerFunction>
// ) {
//   const data = is.object(parameters[0])
//     ? (parameters.shift() as Record<string, unknown>)
//     : {};
//   const message = is.string(parameters[0])
//     ? (parameters.shift() as string)
//     : ``;
//   logger[method](
//     {
//       context,
//       ...data,
//     },
//     message,
//     ...parameters,
//   );
// }

export type CONTEXT_COLORS =
  | "grey"
  | "blue"
  | "yellow"
  | "red"
  | "green"
  | "magenta";
const MAX_CUTOFF = 2000;
const frontDash = " - ";

export async function ZCC_Logger({ lifecycle, config }: TServiceParams) {
  const chalk = (await import("chalk")).default;

  function log(
    method: pino.Level,
    context: TContext,
    ...parameters: Parameters<TLoggerFunction>
  ): void {
    // standardLogger(method, context, ...parameters);
    prettyLogger(method, context, ...parameters);
  }

  const YELLOW_DASH = chalk.yellowBright(frontDash);
  const highlightContext = (context: TContext, level: CONTEXT_COLORS): string =>
    chalk.bold[level](`[${context}]`);

  const prettyFormatMessage = (message: string): string => {
    if (!message) {
      return ``;
    }
    if (message.length > MAX_CUTOFF) {
      return message;
    }
    message = message
      // ? partA#partB - highlight it all in yellow
      .replaceAll(new RegExp("([^ ]+#[^ ]+)", "g"), i => chalk.yellow(i))
      // ? [A] > [B] > [C] - highlight the >'s in blue
      .replaceAll("] > [", chalk`] {blue >} [`)
      // ? [Text] - strip brackets, highlight magenta
      .replaceAll(new RegExp("(\\[[^\\]\\[]+\\])", "g"), i =>
        chalk.bold.magenta(i.slice(1, -1)),
      )
      // ? {Text} - strip braces, highlight gray
      .replaceAll(new RegExp("(\\{[^\\]}]+\\})", "g"), i =>
        chalk.bold.gray(i.slice(1, -1)),
      );
    // ? " - Text" (line prefix with dash) - highlight dash
    if (message.slice(0, frontDash.length) === frontDash) {
      message = `${YELLOW_DASH}${message.slice(frontDash.length)}`;
    }
    return message;
  };

  function prettyLogger(
    method: pino.Level,
    context: TContext,
    ...parameters: Parameters<TLoggerFunction>
  ) {
    // * If providing an object as the 1st arg
    if (is.object(parameters[0])) {
      const data = parameters.shift() as {
        context?: TContext;
        error?: Error | string;
        stack?: string | string[];
      };

      // Extract the context property, and use it in place of generated
      if (is.string(data.context) && !is.empty(data.context)) {
        context = data.context;
        delete data.context;
      }
      const message = [
        highlightContext(context, METHOD_COLORS.get(method)),
        prettyFormatMessage(parameters.shift() as string),
      ].join(" ");

      if ("error" in data && data.error instanceof Error) {
        // pino is doing something weird, not sure why it won't print useful stuff about the error
        // this keeps the stack attach
        data.stack = data.error.stack.trim().split("\n");
      }

      logger[method](data, message, ...parameters);
      return;
    }

    // * Text only log
    const message = [
      highlightContext(context, METHOD_COLORS.get(method)),
      prettyFormatMessage(parameters.shift() as string),
    ].join(" ");
    logger[method](message, ...parameters);
  }

  // tuned to be most useful in debugging this
  inspect.defaultOptions.colors = true;
  inspect.defaultOptions.depth = 10;
  inspect.defaultOptions.numericSeparator = true;
  inspect.defaultOptions.compact = false;
  inspect.defaultOptions.colors = true;

  let logLevel: pino.Level = "debug";
  const shouldLog = (level: pino.Level) =>
    LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[logLevel];

  function createBaseLogger() {
    logger = pino(
      {
        level: config.boilerplate.LOG_LEVEL,
        transport: {
          options: {
            colorize: true,
            crlf: false,
            customPrettifiers: {},
            errorLikeObjectKeys: ["err", "error"],
            errorProps: "error",
            hideObject: false,
            ignore: "pid,hostname,level",
            levelFirst: false,
            levelKey: "level",
            messageKey: "msg",
            singleLine: false,
            timestampKey: "time",
            translateTime: "SYS:ddd hh:MM:ss.l",
          },
          target: "pino-pretty",
        },
      },
      pino.destination({ sync: true }),
    ) as ILogger;
  }
  lifecycle.onPostConfig(() => createBaseLogger());
  const out = {
    context: (context: string | TContext) =>
      ({
        debug: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("debug") && log("debug", context as TContext, ...params),
        error: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("error") && log("error", context as TContext, ...params),
        fatal: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("fatal") && log("fatal", context as TContext, ...params),
        info: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("info") && log("info", context as TContext, ...params),
        trace: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("trace") && log("trace", context as TContext, ...params),
        warn: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("warn") && log("warn", context as TContext, ...params),
      }) as ILogger,
    getBaseLogger: () => logger,
    getLogLevel: () => logLevel,
    setBaseLogger: (base: ILogger) => (logger = base),
    setLogLevel: (level: pino.Level) => {
      logLevel = level;
      ZCC.config.set("boilerplate", "LOG_LEVEL", level);
    },
  };
  ZCC.logger = out;
  ZCC.systemLogger = ZCC.logger.context("ZCC:system");

  return out;
}

declare module "../../utilities" {
  export interface ZCCDefinition {
    logger: Awaited<ReturnType<typeof ZCC_Logger>>;
    systemLogger: ILogger;
  }
}
