/* eslint-disable @typescript-eslint/no-magic-numbers */
import { pino } from "pino";
import { inspect } from "util";

import { is, TContext, ZCC } from "../../utilities";
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

function log(
  method: pino.Level,
  context: string,
  ...parameters: Parameters<TLoggerFunction>
): void {
  standardLogger(method, context, ...parameters);
}

export function ZCC_Logger({ lifecycle, config }: TServiceParams) {
  // tuned to be most useful in debugging this
  inspect.defaultOptions.colors = true;
  inspect.defaultOptions.depth = 10;
  inspect.defaultOptions.numericSeparator = true;
  inspect.defaultOptions.compact = false;
  inspect.defaultOptions.colors = true;

  let logLevel: pino.Level = "info";
  const shouldLog = (level: pino.Level) =>
    LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[logLevel];

  function createBaseLogger() {
    logLevel = config.boilerplate.LOG_LEVEL;
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
      ZCC.config.set("boilerplate", "LOG_LEVEL", level);
    },
  };
  ZCC.logger = out;
  ZCC.systemLogger = ZCC.logger.context("ZCC:system");

  return out;
}

declare module "../../utilities" {
  export interface ZCCDefinition {
    logger: ReturnType<typeof ZCC_Logger>;
    systemLogger: ILogger;
  }
}
