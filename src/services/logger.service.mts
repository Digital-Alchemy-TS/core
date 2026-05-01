/* eslint-disable sonarjs/slow-regex */
import { format, inspect } from "node:util";

import chalk from "chalk";
import dayjs from "dayjs";

import type {
  DigitalAlchemyLogger,
  FlatServiceNames,
  GetLogger,
  ILogger,
  LoadedModuleNames,
  LogStreamTarget,
  TConfigLogLevel,
  TContext,
  TLoggerFunction,
  TServiceParams,
} from "../index.mts";
import { EVENT_UPDATE_LOG_LEVELS, fatalLog, FIRST, METHOD_COLORS, START } from "../index.mts";

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

/**
 * Logger factory — chalk/stdout formatter, ALS integration, level filtering,
 * multi-target fan-out, and the `context(ctx)` builder.
 *
 * @remarks
 * Owns the module-level `logger` record that maps each log level to a
 * formatting+routing function. That record is replaced wholesale when a
 * `customLogger` is provided via bootstrap options.
 *
 * The `context(ctx)` method returns a `GetLogger` scoped to a specific
 * `TContext` string. Each scoped logger evaluates `shouldILog[level]` on every
 * call so level changes propagated via `EVENT_UPDATE_LOG_LEVELS` take effect
 * immediately without any per-call config lookup.
 *
 * **Pretty format** applies chalk colorization and bracket/brace highlighting
 * to messages up to `MAX_CUTOFF` characters. Turn it off (e.g. for Docker
 * log aggregators) via `loggerOptions.pretty = false` in bootstrap options.
 *
 * **ALS integration** (`loggerOptions.als = true`) merges per-request data
 * stored in `AsyncLocalStorage` into every log payload, and can substitute a
 * thread-local child logger for the default stdout writer.
 *
 * **Extra targets** (`addTarget`) accept either a `LogStreamTarget` function
 * (raw msg + payload) or any object that conforms to `GetLogger` (same level
 * methods as the default logger). All registered targets receive every log
 * regardless of the `stdOut` setting.
 */
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
  const extraTargets = new Set<GetLogger | LogStreamTarget>();

  internal.boot.options ??= {};
  const { loggerOptions = {} } = internal.boot.options;

  loggerOptions.stdOut ??= true;
  const timestampFormat = loggerOptions.timestampFormat ?? "ddd HH:mm:ss.SSS";
  loggerOptions.mergeData ??= {};

  const YELLOW_DASH = chalk.yellowBright(frontDash);
  const BLUE_TICK = chalk.blue(`>`);
  let prettyFormat = is.boolean(loggerOptions.pretty) ? loggerOptions.pretty : true;
  // keep inspect colorization in sync with the pretty flag so object dumps
  // look consistent whether output goes to a TTY or a log aggregator
  inspect.defaultOptions.colors = prettyFormat;

  // #MARK: mergeData
  /**
   * Augment a log data object with counter, ALS fields, and `mergeData` overrides.
   *
   * @remarks
   * When `loggerOptions.als` is enabled, reads the current ALS store and merges
   * it into the payload. Also pulls the optional thread-local child logger that
   * ALS callers can inject to redirect a specific request's logs somewhere else.
   */
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

  // #MARK: prettyFormatMessage
  /**
   * Apply chalk syntax highlighting to a log message string.
   *
   * @remarks
   * Only runs when `prettyFormat` is true and the message is under
   * `MAX_CUTOFF` characters — very long strings are passed through verbatim
   * to avoid performance degradation from heavy regex over large payloads.
   *
   * Highlighting rules:
   * - `word#word` → yellow (symbol-style identifiers)
   * - `[A] > [B]` → blue `>` separators
   * - `[Text]` → bold magenta, brackets stripped
   * - `{Text}` → bold gray, braces stripped
   * - Leading ` - ` dash prefix → yellow dash
   */
  function prettyFormatMessage(message: string): string {
    if (!message) {
      return ``;
    }
    // skip expensive regex on very long messages or when pretty is disabled
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
    // build a per-level formatter function and store it in the module-level logger record;
    // each function closes over the shared prettyFormat/extraTargets state so runtime
    // changes (setPrettyFormat, addTarget) take effect on the next log call
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

        // functions are commonly passed as the `name` field to tag the call-site;
        // extract the declared `.name` string and discard the function reference
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

        // emit logs to external targets before the stdOut guard so targets always
        // receive every message regardless of whether stdout is suppressed
        extraTargets.forEach(target => {
          // stream targets, just take all messages and do the exact same thing with them
          // ex: send to http endpoint
          if (is.function(target)) {
            target(msg, rawData);
            return;
          }
          // something that conforms to the basic logger interface
          (target as GetLogger)[key](msg, rawData);
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
          // only inspect extra fields that aren't already rendered in the message line
          if (!is.empty(extra)) {
            message +=
              "\n" +
              inspect(extra, {
                compact: false,
                depth: 10,
                numericSeparator: true,
                sorted: true,
              })
                .split("\n")
                .slice(SYMBOL_START, SYMBOL_END)
                .join("\n");
          }
        }
        // ALS child logger takes precedence so per-request log redirection works
        if (child) {
          child[key](message);
          return;
        }

        // #MARK: globalThis.console
        // route through the appropriate console method so browser devtools and
        // Node's built-in log level filtering see the right severity
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
            fatalLog(message);
            return;
          }
          default: {
            globalThis.console.log(message);
          }
        }
      };
    });
  } else {
    // custom logger provided at bootstrap — use it verbatim instead of the built-in formatter
    logger = internal.boot.options.customLogger;
  }

  // if bootstrap hard coded something specific, then start there;
  // otherwise be noisy until config loads a user preference
  //
  // stored as a separate variable to avoid per-call config proxy lookups
  let CURRENT_LOG_LEVEL: TConfigLogLevel =
    internal.utils.object.get(internal, "boot.options.configuration.boilerplate.LOG_LEVEL") ||
    "trace";

  // #MARK: context
  /**
   * Create a `GetLogger` scoped to a specific `TContext` string.
   *
   * @remarks
   * Each returned logger checks `shouldILog[level]` before forwarding the
   * call, making the check a simple boolean property access on every log line.
   * `shouldILog` is rebuilt whenever `EVENT_UPDATE_LOG_LEVELS` fires, so
   * level overrides and global level changes propagate to all existing scoped
   * loggers automatically.
   *
   * Level resolution order: per-service override → module-level override → global level.
   */
  function context(context: string | TContext) {
    const name = context as FlatServiceNames;
    const shouldILog = {} as Record<TConfigLogLevel, boolean>;
    const [prefix] = context.split(":") as [LoadedModuleNames];
    const update = () => {
      LOG_LEVELS.forEach((key: TConfigLogLevel) => {
        // global level
        let target = LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL];

        // per-service override takes priority over module-level override
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
    } as GetLogger;
  }

  // #MARK updateShouldLog:
  /**
   * Sync `CURRENT_LOG_LEVEL` from config and broadcast a level-update event.
   *
   * @remarks
   * Called after `onPostConfig` (when the user's `LOG_LEVEL` preference is
   * available) and on every subsequent `boilerplate.LOG_LEVEL` config change.
   * Emitting `EVENT_UPDATE_LOG_LEVELS` causes every scoped logger's `shouldILog`
   * map to be rebuilt synchronously so level changes take effect immediately.
   */
  function updateShouldLog() {
    if (!is.empty(config.boilerplate.LOG_LEVEL)) {
      CURRENT_LOG_LEVEL = config.boilerplate.LOG_LEVEL;
    }
    event.emit(EVENT_UPDATE_LOG_LEVELS);
  }

  // #MARK: lifecycle
  // only read config after PostConfig fires; value is undefined before that
  lifecycle.onPostConfig(() => internal.boilerplate.logger.updateShouldLog());
  // also update whenever LOG_LEVEL is changed at runtime (e.g. via setConfig)
  internal.boilerplate.configuration.onUpdate(
    () => internal.boilerplate.logger.updateShouldLog(),
    "boilerplate",
    "LOG_LEVEL",
  );

  /**
   * Register an additional log destination.
   *
   * @remarks
   * Accepts either a `LogStreamTarget` function `(msg, rawData) => void`
   * or any object that implements the `GetLogger` interface. All registered
   * targets receive every log message before the `stdOut` guard, so targets
   * see logs even when `stdOut` is disabled.
   */
  function addTarget(target: GetLogger | LogStreamTarget) {
    extraTargets.add(target);
  }

  // #MARK: return object
  return {
    /**
     * Register an additional log destination (function or `GetLogger` object).
     */
    addTarget,
    /**
     * Create a `GetLogger` scoped to the given context string.
     */
    context,
    /**
     * Access the raw per-level formatter record.
     * @internal
     */
    getBaseLogger: () => logger,
    /**
     * Return the current pretty-format flag.
     */
    getPrettyFormat: () => prettyFormat,
    /**
     * Apply chalk syntax highlighting to a message string (respects `prettyFormat` flag).
     */
    prettyFormatMessage,
    /**
     * Replace the underlying per-level formatter record.
     * @internal
     */
    setBaseLogger: base => (logger = base),
    /**
     * Toggle chalk colorization on stdout output.
     *
     * @remarks
     * Also updates `inspect.defaultOptions.colors` so object dumps remain consistent.
     */
    setPrettyFormat: state => {
      prettyFormat = state;
      inspect.defaultOptions.colors = prettyFormat;
      return prettyFormat;
    },
    /**
     * Pre-built scoped logger for the framework's own internal log lines.
     */
    systemLogger: context("digital-alchemy:system-logger"),
    /**
     * Sync the active log level from config and notify all scoped loggers.
     */
    updateShouldLog,
  };
}
