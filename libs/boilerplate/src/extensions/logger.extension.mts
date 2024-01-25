/* eslint-disable @typescript-eslint/no-magic-numbers */
import { is, SECOND, TContext, ZCC } from "@zcc/utilities";
import chalk from "chalk";
import chalkTemplate from "chalk-template";
import { Level, pino } from "pino";
import { inspect } from "util";

import {
  LOGGER_CONTEXT_ENTRIES_COUNT,
  TServiceParams,
} from "../helpers/index.mjs";
import { LIB_BOILERPLATE } from "./wiring.extension.mjs";

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

const FRONT_DASH = " - ";
const YELLOW_DASH = chalk.yellowBright(FRONT_DASH);
let logger = pino(
  {
    level: "info",
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
let maxCutoff = 2000;
let usePrettyLogger = true;

const LOG_LEVEL_PRIORITY = {
  debug: 20,
  error: 50,
  fatal: 60,
  info: 30,
  trace: 10,
  warn: 40,
};

export type TContextColorType =
  | "bgBlue.dim"
  | "bgYellow.dim"
  | "bgGreen"
  | "bgRed"
  | "bgMagenta"
  | "bgGrey";

export const METHOD_COLORS = new Map<pino.Level, TContextColorType>([
  ["trace", "bgGrey"],
  ["debug", "bgBlue.dim"],
  ["warn", "bgYellow.dim"],
  ["error", "bgRed"],
  ["info", "bgGreen"],
  ["fatal", "bgMagenta"],
]);

export function prettyFormatMessage(message: string): string {
  if (!message) {
    return ``;
  }
  if (message.length > maxCutoff) {
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
  if (message.slice(0, FRONT_DASH.length) === FRONT_DASH) {
    message = `${YELLOW_DASH}${message.slice(FRONT_DASH.length)}`;
  }
  return message;
}

const HIGHLIGHTED_CONTEXT_CACHE: Record<string, string> = {};

export function highlightContext(
  context: string,
  level: TContextColorType = "bgGrey",
): string {
  const PAIR = context + level;
  HIGHLIGHTED_CONTEXT_CACHE[PAIR] ??= chalkTemplate`{bold.${level
    .slice(2)
    .toLowerCase()} [${context}]}`;
  return HIGHLIGHTED_CONTEXT_CACHE[PAIR];
}

function standardLogger(
  method: pino.Level,
  context: string,
  ...parameters: Parameters<TLoggerFunction>
) {
  const data = is.object(parameters[0])
    ? (parameters.shift() as Record<string, unknown>)
    : {};
  const message = is.string(parameters[0])
    ? (parameters.shift() as string)
    : ``;
  logger[method](
    {
      context,
      ...data,
    },
    message,
    ...parameters,
  );
}

function prettyLogger(
  method: pino.Level,
  context: string,
  ...parameters: Parameters<TLoggerFunction>
) {
  // * If providing an object as the 1st arg
  if (is.object(parameters[0])) {
    const data = parameters.shift() as { context?: string };
    // Extract the context property, and use it in place of generated
    if (is.string(data.context) && !is.empty(data.context)) {
      context = data.context;
      delete data.context;
    }
    const message = [
      highlightContext(context, METHOD_COLORS.get(method)),
      prettyFormatMessage(parameters.shift() as string),
    ].join(" ");
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

function log(
  method: pino.Level,
  context: string,
  ...parameters: Parameters<TLoggerFunction>
): void {
  if (usePrettyLogger) {
    prettyLogger(method, context, ...parameters);
    return;
  }
  standardLogger(method, context, ...parameters);
}

export function ZCC_Logger({ lifecycle, getApis, context }: TServiceParams) {
  // tuned to be most useful in debugging this
  inspect.defaultOptions.colors = true;
  inspect.defaultOptions.depth = 10;
  inspect.defaultOptions.numericSeparator = true;
  inspect.defaultOptions.compact = false;
  inspect.defaultOptions.colors = true;

  const apis = getApis(LIB_BOILERPLATE);

  lifecycle.onBootstrap(() => {
    if (!LIB_BOILERPLATE.getConfig("LOG_LEVEL")) {
      return;
    }
    // logger loads first, this is the easiest way to access the scheduler
    apis.schedule({
      context,
      exec: () => {
        const count = Object.keys(HIGHLIGHTED_CONTEXT_CACHE).length;
        LOGGER_CONTEXT_ENTRIES_COUNT.set(count);
      },
      interval: 10 * SECOND,
    });
  });

  let logLevel: pino.Level = "info";
  const shouldLog = (level: pino.Level) =>
    LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[logLevel];

  function createBaseLogger() {
    logLevel = LIB_BOILERPLATE.getConfig("LOG_LEVEL") as Level;
    logger = pino(
      {
        level: "info",
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
    // }
    // logger = pino(
    //   {
    //     level: LIB_BOILERPLATE.getConfig(LOG_LEVEL),
    //     transport: {
    //       options: {
    //         colorize: true,
    //         crlf: false,
    //         customPrettifiers: {},
    //         errorLikeObjectKeys: ["err", "error"],
    //         errorProps: "",
    //         hideObject: false,
    //         ignore: "pid,hostname",
    //         levelKey: ``,
    //         messageKey: "msg",
    //         timestampKey: "time",
    //         translateTime: "SYS:ddd hh:MM:ss.l",
    //       },
    //       target: "pino-pretty",
    //     },
    //   },
    //   pino.destination({ sync: true }),
    // );
  }
  lifecycle.onPostConfig(() => createBaseLogger());
  const out = {
    LOGGER_CACHE: () => HIGHLIGHTED_CONTEXT_CACHE,
    context: (context: string | TContext) =>
      ({
        debug: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("debug") && log("debug", context, ...params),
        error: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("error") && log("error", context, ...params),
        fatal: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("fatal") && log("fatal", context, ...params),
        info: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("info") && log("info", context, ...params),
        trace: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("trace") && log("trace", context, ...params),
        warn: (...params: Parameters<TLoggerFunction>) =>
          shouldLog("warn") && log("warn", context, ...params),
      }) as ILogger,
    getBaseLogger: () => logger,
    getLogLevel: () => logLevel,
    setBaseLogger: (base: ILogger) => (logger = base),
    setLogLevel: (level: pino.Level) => {
      logLevel = level;
      ZCC.config.set(["boilerplate", "LOG_LEVEL"], level);
    },
    setMaxCutoff: (cutoff: number) => (maxCutoff = cutoff),
    setPrettyLogger: (state: boolean) => {
      usePrettyLogger = state;
      createBaseLogger();
    },
  };
  ZCC.logger = out;
  ZCC.systemLogger = ZCC.logger.context("ZCC:system");

  return out;
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    logger: ReturnType<typeof ZCC_Logger>;
    systemLogger: ILogger;
  }
}
