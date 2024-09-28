/* eslint-disable sonarjs/slow-regex */
import chalk from "chalk";
import dayjs from "dayjs";
import { format, inspect } from "util";

import {
  DigitalAlchemyLogger,
  EVENT_UPDATE_LOG_LEVELS,
  FIRST,
  ILogger,
  is,
  LoadedModuleNames,
  METHOD_COLORS,
  ServiceNames,
  START,
  TConfigLogLevel,
  TContext,
  TLoggerFunction,
  TServiceParams,
} from "..";

const LOG_LEVEL_PRIORITY = {
  debug: 20,
  error: 50,
  fatal: 60,
  info: 30,
  silent: 100,
  trace: 10,
  warn: 40,
};
const DECIMALS = 2;
const LOG_LEVELS = Object.keys(LOG_LEVEL_PRIORITY) as TConfigLogLevel[];

let logger = {} as Record<
  keyof ILogger,
  (context: TContext, ...data: Parameters<TLoggerFunction>) => void
>;

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
  let lastMessage = performance.now();
  let logCounter = START;
  let httpLogTarget: string;

  internal.boot.options ??= {};
  const { loggerOptions = {} } = internal.boot.options;

  const timestampFormat = loggerOptions.timestampFormat ?? "ddd HH:mm:ss.SSS";
  loggerOptions.mergeData ??= {};

  const YELLOW_DASH = chalk.yellowBright(frontDash);
  const BLUE_TICK = chalk.blue(`>`);
  let prettyFormat = is.boolean(loggerOptions.pretty) ? loggerOptions.pretty : true;

  function emitHttpLogs(data: object) {
    if (is.empty(httpLogTarget)) {
      return;
    }
    // validated with datadog, probably is fine elsewhere too
    // https://http-intake.logs.datadoghq.com/v1/input/{API_KEY}
    global.fetch(httpLogTarget, {
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  function mergeData<T extends object>(data: T): T {
    let out = { ...data, ...loggerOptions.mergeData };

    if (loggerOptions.counter) {
      const counter = out as { logIdx: number };
      counter.logIdx = logCounter++;
    }

    if (loggerOptions.als) {
      out = { ...out, ...als.getLogData() };
    }

    return out;
  }

  const prettyFormatMessage = (message: string): string => {
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
  };

  if (is.empty(internal.boot.options?.customLogger)) {
    // #MARK: formatter
    [...METHOD_COLORS.keys()].forEach(key => {
      const level = `[${key.toUpperCase()}]`.padStart(LEVEL_MAX, " ");
      logger[key] = (context: TContext, ...parameters: Parameters<TLoggerFunction>) => {
        const data = mergeData(
          is.object(parameters[FIRST])
            ? (parameters.shift() as {
                context?: TContext;
                error?: Error | string;
                name?: string | { name: string };
                stack?: string | string[];
              })
            : {},
        );

        const rawData = {
          ...data,
          level: key,
          timestamp: Date.now(),
        } as Record<string, unknown>;

        const highlighted = chalk.bold[METHOD_COLORS.get(key)](`[${data.context || context}]`);
        const name = is.object(data.name) || is.function(data.name) ? data.name.name : data.name;
        delete data.context;
        delete data.name;

        const timestamp = chalk.white(`[${dayjs().format(timestampFormat)}]`);
        let prettyMessage: string;
        if (!is.empty(parameters)) {
          const text = parameters.shift() as string;
          rawData.msg = format(text, ...parameters);
          prettyMessage = format(prettyFormatMessage(text), ...parameters);
        }

        let ms = "";
        if (loggerOptions.ms) {
          const now = performance.now();
          ms = "+" + (now - lastMessage).toFixed(DECIMALS) + `ms`;
          lastMessage = now;
          rawData.ms = ms;
        }
        let message = `${ms}${timestamp} ${level}${highlighted}`;

        if (!is.empty(name)) {
          message += chalk.blue(` (${name})`);
        }

        emitHttpLogs(rawData);

        if (!is.empty(prettyMessage)) {
          message += `: ${chalk.cyan(prettyMessage)}`;
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
          global.console.error(message);
          return;
        }

        global.console.log(message);
      };
    });
  } else {
    logger = internal.boot.options.customLogger;
  }

  // #MARK: instances
  // if bootstrap hard coded something specific, then start there
  // otherwise, be noisy until config loads a user preference
  //
  // stored as separate variable to cut down on internal config lookups
  let CURRENT_LOG_LEVEL: TConfigLogLevel =
    internal.utils.object.get(internal, "boot.options.configuration.boilerplate.LOG_LEVEL") ||
    "trace";

  function context(context: string | TContext) {
    const name = context as ServiceNames;
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

  const updateShouldLog = () => {
    if (!is.empty(config.boilerplate.LOG_LEVEL)) {
      CURRENT_LOG_LEVEL = config.boilerplate.LOG_LEVEL;
    }
    event.emit(EVENT_UPDATE_LOG_LEVELS);
  };

  // #MARK: lifecycle
  lifecycle.onPostConfig(() => internal.boilerplate.logger.updateShouldLog());
  internal.boilerplate.configuration.onUpdate(
    () => internal.boilerplate.logger.updateShouldLog(),
    "boilerplate",
    "LOG_LEVEL",
  );

  // #MARK: return object
  return {
    context,
    getBaseLogger: () => logger,
    getPrettyFormat: () => prettyFormat,
    prettyFormatMessage,
    setBaseLogger: base => (logger = base),
    setHttpLogs: url => (httpLogTarget = url),
    setPrettyFormat: state => (prettyFormat = state),
    systemLogger: context("digital-alchemy:system-logger"),
    updateShouldLog,
  };
}
