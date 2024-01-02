/* eslint-disable @typescript-eslint/no-magic-numbers */
import { is, ZCC } from "@zcc/utilities";
import chalk from "chalk";
import { pino } from "pino";

export type LoggerFunction =
  | ((message: string, ...arguments_: unknown[]) => void)
  | ((object: object, message?: string, ...arguments_: unknown[]) => void);

export interface iLogger extends iLoggerCore {
  debug(message: string, ...arguments_: unknown[]): void;
  debug(...arguments_: Parameters<LoggerFunction>): void;
  error(message: string, ...arguments_: unknown[]): void;
  error(...arguments_: Parameters<LoggerFunction>): void;
  fatal(message: string, ...arguments_: unknown[]): void;
  fatal(...arguments_: Parameters<LoggerFunction>): void;
  info(message: string, ...arguments_: unknown[]): void;
  info(...arguments_: Parameters<LoggerFunction>): void;
  trace(message: string, ...arguments_: unknown[]): void;
  trace(...arguments_: Parameters<LoggerFunction>): void;
  warn(message: string, ...arguments_: unknown[]): void;
  warn(...arguments_: Parameters<LoggerFunction>): void;
}

export interface iLoggerCore {
  debug(object: object, message?: string, ...arguments_: unknown[]): void;
  error(object: object, message?: string, ...arguments_: unknown[]): void;
  fatal(object: object, message?: string, ...arguments_: unknown[]): void;
  info(object: object, message?: string, ...arguments_: unknown[]): void;
  trace(object: object, message?: string, ...arguments_: unknown[]): void;
  warn(object: object, message?: string, ...arguments_: unknown[]): void;
}

const MAX_CUTOFF = 2000;
const frontDash = " - ";
const YELLOW_DASH = chalk.yellowBright(frontDash);
const logger = pino() as iLogger;
let logLevel: pino.Level = "info";
let usePrettyLogger = true;

export type CONTEXT_COLORS =
  | "bgBlue.dim"
  | "bgYellow.dim"
  | "bgGreen"
  | "bgRed"
  | "bgMagenta"
  | "bgGrey";

export const METHOD_COLORS = new Map<pino.Level, CONTEXT_COLORS>([
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
}

function highlightContext(
  context: string,
  level: CONTEXT_COLORS = "bgGrey",
): string {
  return chalk`{bold.${level.slice(2).toLowerCase()} [${context}]}`;
}

function normalLogger(
  method: pino.Level,
  context: string,
  ...parameters: Parameters<LoggerFunction>
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
  ...parameters: Parameters<LoggerFunction>
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

function call(
  method: pino.Level,
  context: string,
  ...parameters: Parameters<LoggerFunction>
): void {
  if (usePrettyLogger) {
    prettyLogger(method, context, ...parameters);
    return;
  }
  normalLogger(method, context, ...parameters);
}

export function ContextLogger(context: string): iLogger {
  return {
    debug: (...params: Parameters<LoggerFunction>) =>
      call("debug", context, ...params),
    error: (...params: Parameters<LoggerFunction>) =>
      call("error", context, ...params),
    fatal: (...params: Parameters<LoggerFunction>) =>
      call("fatal", context, ...params),
    info: (...params: Parameters<LoggerFunction>) =>
      call("info", context, ...params),
    trace: (...params: Parameters<LoggerFunction>) =>
      call("trace", context, ...params),
    warn: (...params: Parameters<LoggerFunction>) =>
      call("warn", context, ...params),
  };
}

export function LibraryLogger() {
  //
}

function AugmentLogger() {
  return {
    setLogLevel: (level: pino.Level) => (logLevel = level),
    setPrettyLogger: (state: boolean) => (usePrettyLogger = state),
  };
}

declare module "@zcc/utilities" {
  export interface ZCC_Definition {
    logger: ReturnType<typeof AugmentLogger>;
  }
}
ZCC.logger = AugmentLogger();
