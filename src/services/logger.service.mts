/* eslint-disable sonarjs/slow-regex */
import chalk from "chalk";
import dayjs from "dayjs";
import { writeSync } from "fs";
import { format, inspect } from "util";

import type {
  DigitalAlchemyLogger,
  FlatServiceNames,
  ILogger,
  LoadedModuleNames,
  LogStreamTarget,
  TConfigLogLevel,
  TContext,
  TLoggerFunction,
  TServiceParams,
} from "../index.mts";
import { EVENT_UPDATE_LOG_LEVELS, FIRST, METHOD_COLORS, START } from "../index.mts";

const LOG_LEVEL_PRIORITY = {
  debug: 20,
  error: 50,
  fatal: 60,
  info: 30,
  silent: 100,
  trace: 10,
  warn: 40,
};
export const VALID_LOG_LEVELS = Object.keys(
  LOG_LEVEL_PRIORITY,
) as (keyof typeof LOG_LEVEL_PRIORITY)[];

const DECIMALS = 2;
const LOG_LEVELS = Object.keys(LOG_LEVEL_PRIORITY) as TConfigLogLevel[];

let logger = {} as ILogger;

const MAX_CUTOFF = 2000;
const frontDash = " - ";
const SYMBOL_START = 1;
const SYMBOL_END = -1;
const LEVEL_MAX = 7;

export async function Logger({
  lifecycle,
  config,
  event,
  internal,
  als,
}: TServiceParams): Promise<DigitalAlchemyLogger> {
  const { is } = internal.utils;
  let lastMessage = performance.now();
  let logCounter = START;
  const extraTargets = new Set<ILogger | LogStreamTarget>();

  internal.boot.options ??= {};
  const { loggerOptions = {} } = internal.boot.options;

  loggerOptions.stdOut ??= true;
  const timestampFormat = loggerOptions.timestampFormat ?? "ddd HH:mm:ss.SSS";
  loggerOptions.mergeData ??= {};

  const YELLOW_DASH = chalk.yellowBright(frontDash);
  const BLUE_TICK = chalk.blue(`>`);
  let prettyFormat = is.boolean(loggerOptions.pretty) ? loggerOptions.pretty : true;
  // make sure the object formatter respects the pretty option
  // if this is enabled while outputting to docker logs, the output becomes much harder to read
  inspect.defaultOptions.colors = prettyFormat;

  // #MARK: mergeData
  function mergeData<T extends object>(data: T): [T, ILogger] {
    let out = { ...data, ...loggerOptions.mergeData };

    if (loggerOptions.counter) {
      const counter = out as { logIdx: number };
      counter.logIdx = logCounter++;
    }

    let logger: ILogger;
    if (loggerOptions.als) {
      const { duration, logger: replacement, ...data } = als.getLogData();
      logger = replacement;
      const extra = {} as Record<string, unknown>;
      if (duration) {
        extra.elapsed = duration();
      }
      out = { ...out, ...data, ...extra };
    }

    return [out, logger];
  }

  // #MARK: printMessage
  function printMessage(key: keyof ILogger, message: string) {
    switch (key) {
      case "warn": {
        globalThis.console.warn(message);
        return;
      }
      case "debug": {
        globalThis.console.debug(message);
        return;
      }
      case "error": {
        globalThis.console.error(message);
        return;
      }
      case "fatal": {
        // Synchronous write for fatal logs to ensure they are flushed before process exit
        writeSync(process.stderr.fd, `${message}\n`);
        return;
      }
      default: {
        globalThis.console.log(message);
      }
    }
  }

  // #MARK: prettyFormatMessage
  function prettyFormatMessage(message: string): string {
    if (!message) {
      return ``;
    }
    if (!prettyFormat || message.length > MAX_CUTOFF) {
      return message;
    }
    // ? partA#partB - highlight it all in yellow
    message = message.replaceAll(new RegExp("([^ ]+#[^ ]+)", "g"), i => chalk.yellow(i));
    // ? [A] > [B] > [C] - highlight the >'s in blue
    message = message.replaceAll("] > [", `] ${BLUE_TICK} [`);
    // ? [Text] - strip brackets, highlight magenta
    message = message.replaceAll(new RegExp(String.raw`(\[[^\]\[]+\])`, "g"), i =>
      chalk.bold.magenta(i.slice(SYMBOL_START, SYMBOL_END)),
    );
    // ? {Text} - strip braces, highlight gray
    message = message.replaceAll(new RegExp(String.raw`(\{[^\]}]+\})`, "g"), i =>
      chalk.bold.gray(i.slice(SYMBOL_START, SYMBOL_END)),
    );
    // ? " - Text" (line prefix with dash) - highlight dash
    if (message.slice(START, frontDash.length) === frontDash) {
      message = `${YELLOW_DASH}${message.slice(frontDash.length)}`;
    }
    return message;
  }

  if (is.empty(internal.boot.options?.customLogger)) {
    // #MARK: formatter
    [...METHOD_COLORS.keys()].forEach(key => {
      logger[key] = (context: TContext, ...parameters: Parameters<TLoggerFunction>) => {
        const [data, child] = mergeData(
          is.object(parameters[FIRST])
            ? (parameters.shift() as {
                context?: TContext;
                error?: Error | string;
                name?: string | { name: string };
                stack?: string | string[];
              })
            : {},
        );

        // common for functions to be thrown in
        // extract it's declared name and discard the rest of the info
        data.name = is.object(data.name) || is.function(data.name) ? data.name.name : data.name;

        // ? full data object representing this log
        // used with cloud logging (graylog, datadog, etc)
        const rawData = {
          ...data,
          context: data.context || context,
          level: key,
          timestamp: Date.now(),
        } as Record<string, unknown>;
        let prettyMessage: string;
        let msg = "";

        // > logger.info("text", ...parameters);
        // convert a message + parameters set down to a simple string
        if (!is.empty(parameters)) {
          const text = parameters.shift() as string;
          msg = format(text, ...parameters);
          if (loggerOptions.stdOut) {
            prettyMessage = format(prettyFormatMessage(text), ...parameters);
          }
        }

        // ms since last log message
        let ms = "";
        if (loggerOptions.ms) {
          const now = performance.now();
          const duration = (now - lastMessage).toFixed(DECIMALS);
          ms = `+${duration}ms`;
          lastMessage = now;
          rawData.ms = ms;
        }

        // emit logs to external targets
        extraTargets.forEach(target => {
          // stream targets, just take all messages and do the exact same thing with them
          // ex: send to http endpoint
          if (is.function(target)) {
            (target as LogStreamTarget)(msg, rawData);
            return;
          }
          if (is.object(target)) {
            (target as ILogger)[key](rawData, msg);
          }
        });

        // minor performance tuning option:
        // don't do any work to output to stdout if nobody is gonna look at it
        if (!loggerOptions.stdOut) {
          return;
        }

        // #MARK: pretty logs
        const level = `[${key.toUpperCase()}]`.padStart(LEVEL_MAX, " ");
        const highlighted = chalk.bold[METHOD_COLORS.get(key)](`[${data.context || context}]`);
        const timestamp = chalk.white(`[${dayjs().format(timestampFormat)}]`);
        let message = `${ms}${timestamp} ${level}${highlighted}`;

        if (!is.empty(data.name)) {
          message += chalk.blue(` (${String(data.name)})`);
        }

        if (!is.empty(prettyMessage)) {
          message += `: ${chalk.cyan(prettyMessage)}`;
        }
        {
          const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            name,
            // eslint-disable-next-line sonarjs/no-unused-vars, @typescript-eslint/no-unused-vars
            context: ctx,
            ...extra
          } = data;
          if (!is.empty(extra)) {
            message +=
              "\n" +
              inspect(extra, {
                compact: false,
                depth: config.boilerplate.INSPECT_DEPTH,
                numericSeparator: true,
                sorted: true,
              })
                .split("\n")
                .slice(SYMBOL_START, SYMBOL_END)
                .join("\n");
          }
        }
        if (child) {
          child[key](message);
          return;
        }

        printMessage(key, message);
      };
    });
  } else {
    logger = internal.boot.options.customLogger;
  }

  // if bootstrap hard coded something specific, then start there
  // otherwise, be noisy until config loads a user preference
  //
  // stored as separate variable to cut down on internal config lookups
  let CURRENT_LOG_LEVEL: TConfigLogLevel =
    internal.utils.object.get(internal, "boot.options.configuration.boilerplate.LOG_LEVEL") ||
    "trace";

  // #MARK: context
  function context(context: string | TContext) {
    const name = context as FlatServiceNames;
    const shouldILog = {} as Record<TConfigLogLevel, boolean>;
    const [prefix] = context.split(":") as [LoadedModuleNames];
    const update = () => {
      LOG_LEVELS.forEach((key: TConfigLogLevel) => {
        // global level
        let target = LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL];

        // override directly
        if (loggerOptions?.levelOverrides?.[name]) {
          target = LOG_LEVEL_PRIORITY[loggerOptions?.levelOverrides?.[name]];
          // module level override
        } else if (loggerOptions?.levelOverrides?.[prefix]) {
          target = LOG_LEVEL_PRIORITY[loggerOptions?.levelOverrides?.[prefix]];
        }
        shouldILog[key] = LOG_LEVEL_PRIORITY[key] >= target;
      });
    };

    event.on(EVENT_UPDATE_LOG_LEVELS, update);
    update();

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

  // #MARK updateShouldLog:
  function updateShouldLog() {
    if (!is.empty(config.boilerplate.LOG_LEVEL)) {
      CURRENT_LOG_LEVEL = config.boilerplate.LOG_LEVEL;
    }
    event.emit(EVENT_UPDATE_LOG_LEVELS);
  }

  // #MARK: lifecycle
  lifecycle.onPostConfig(() => {
    internal.boilerplate.logger.updateShouldLog();
    inspect.defaultOptions.depth = config.boilerplate.INSPECT_DEPTH;
  });

  lifecycle.onShutdownComplete(() => {
    extraTargets.forEach(i => extraTargets.delete(i));
  }, Number.POSITIVE_INFINITY);

  internal.boilerplate.configuration.onUpdate(
    () => internal.boilerplate.logger.updateShouldLog(),
    "boilerplate",
    "LOG_LEVEL",
  );

  function addTarget(target: ILogger | LogStreamTarget) {
    extraTargets.add(target);
    return internal.removeFn(() => extraTargets.delete(target));
  }

  // #MARK: return object
  return {
    addTarget,
    context,
    getBaseLogger: () => logger,
    getPrettyFormat: () => prettyFormat,
    prettyFormatMessage,
    setBaseLogger: base => (logger = base),
    setPrettyFormat: state => {
      prettyFormat = state;
      inspect.defaultOptions.colors = prettyFormat;
      return prettyFormat;
    },
    systemLogger: context("digital-alchemy:system-logger"),
    updateShouldLog,
  };
}
