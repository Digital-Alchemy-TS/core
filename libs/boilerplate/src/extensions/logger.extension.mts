/* eslint-disable @typescript-eslint/no-magic-numbers */
import { is, SECOND, ZCC } from "@zcc/utilities";
import chalk from "chalk";
import { pino } from "pino";

import { LOGGER_CONTEXT_ENTRIES_COUNT } from "../helpers/metrics.helper.mjs";

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
let logger = pino() as ILogger;
let maxCutoff = 2000;
let logLevel: pino.Level = "info";
let usePrettyLogger = true;

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

function prettyFormatMessage(message: string): string {
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
setInterval(() => {
  const contextEntriesCount = Object.keys(HIGHLIGHTED_CONTEXT_CACHE).length;
  LOGGER_CONTEXT_ENTRIES_COUNT.set(contextEntriesCount);
}, 10 * SECOND);

function highlightContext(
  context: string,
  level: TContextColorType = "bgGrey",
): string {
  const PAIR = context + level;
  return (HIGHLIGHTED_CONTEXT_CACHE[PAIR] =
    HIGHLIGHTED_CONTEXT_CACHE[PAIR] ??
    chalk`{bold.${level.slice(2).toLowerCase()} [${context}]}`);
}

function standardLogger(
  method: pino.Level,
  context: string,
  ...parameters: Parameters<TLoggerFunction>
) {
  if (method === "trace" && logLevel !== "trace") {
    // early shortcut for an over used call
    return;
  }
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
  // ? Early shortcut for an over used call
  if (method === "trace" && logLevel !== "trace") {
    return;
  }
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

function augmentLogger() {
  return {
    context: (context: string) =>
      ({
        debug: (...params: Parameters<TLoggerFunction>) =>
          log("debug", context, ...params),
        error: (...params: Parameters<TLoggerFunction>) =>
          log("error", context, ...params),
        fatal: (...params: Parameters<TLoggerFunction>) =>
          log("fatal", context, ...params),
        info: (...params: Parameters<TLoggerFunction>) =>
          log("info", context, ...params),
        trace: (...params: Parameters<TLoggerFunction>) =>
          log("trace", context, ...params),
        warn: (...params: Parameters<TLoggerFunction>) =>
          log("warn", context, ...params),
      }) as ILogger,
    getBaseLogger: () => logger,
    setBaseLogger: (base: ILogger) => (logger = base),
    setLogLevel: (level: pino.Level) => (logLevel = level),
    setMaxCutoff: (cutoff: number) => (maxCutoff = cutoff),
    setPrettyLogger: (state: boolean) => (usePrettyLogger = state),
  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    logger: ReturnType<typeof augmentLogger>;
    systemLogger: ILogger;
  }
}

ZCC.logger = augmentLogger();
ZCC.systemLogger = ZCC.logger.context("ZCC:system");
