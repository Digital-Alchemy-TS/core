import dayjs, { Dayjs } from "dayjs";
import { EventEmitter } from "events";
import { Counter, Summary } from "prom-client";
import { Get } from "type-fest";

import {
  ApplicationDefinition,
  ARRAY_OFFSET,
  BootstrapOptions,
  DAY,
  FIRST,
  GetApis,
  HOUR,
  is,
  LIB_BOILERPLATE,
  LifecycleStages,
  MINUTE,
  OptionalModuleConfiguration,
  SECOND,
  ServiceMap,
  START,
  TBlackHole,
  TContext,
  TModuleMappings,
  TResolvedModuleMappings,
  YEAR,
} from "..";
import { CreateLifecycle } from "./lifecycle.extension";

const EVERYTHING_ELSE = 1;
const MONTHS = 12;

type inputFormats = Date | string | number | Dayjs;

// TODO: probably should make this configurable
const formatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
});

// #MARK: misc
export class InternalUtils {
  /**
   * The global eventemitter. All of `@digital-alchemy` will be wired through this
   *
   * **NOTE:** bootstrapping process will initialize this at boot, and cleanup at teardown.
   * Making listener changes should only be done from within the context of service functions
   */
  public event = new EventEmitter();

  public TitleCase(input: string): string {
    const matches = input.match(new RegExp("[a-z][A-Z]", "g"));
    if (matches) {
      matches.forEach((i) => (input = input.replace(i, [...i].join(" "))));
    }
    return input
      .split(new RegExp("[ _-]"))
      .map(
        (word = "") =>
          `${word.charAt(FIRST).toUpperCase()}${word.slice(EVERYTHING_ELSE)}`,
      )
      .join(" ");
  }

  public relativeDate(
    pastDate: inputFormats,
    futureDate: inputFormats = new Date().toISOString(),
  ) {
    const UNITS = new Map<Intl.RelativeTimeFormatUnit, number>([
      ["year", YEAR],
      ["month", YEAR / MONTHS],
      ["day", DAY],
      ["hour", HOUR],
      ["minute", MINUTE],
      ["second", SECOND],
    ]);

    if (!pastDate) {
      return `NOT A DATE ${pastDate} ${JSON.stringify(pastDate)}`;
    }
    const elapsed = dayjs(pastDate).diff(futureDate, "ms");
    let out = "";

    [...UNITS.keys()].some((unit) => {
      const cutoff = UNITS.get(unit);
      if (Math.abs(elapsed) > cutoff || unit == "second") {
        out = formatter.format(Math.round(elapsed / cutoff), unit);
        return true;
      }
      return false;
    });

    return out;
  }

  // #region .object
  public object = {
    del<T>(object: T, path: string): void {
      const keys = path.split(".");
      let current = object as unknown; // Starting with the object as an unknown type

      for (let i = START; i < keys.length; i++) {
        const key = keys[i];

        // Check if current is an object and not null
        if (typeof current !== "object" || current === null) {
          // Path does not exist; exit function silently
          return;
        }

        const safeCurrent = current as Record<string, unknown>;

        // If we're at the last key, attempt to delete the property
        if (i === keys.length - ARRAY_OFFSET) {
          delete safeCurrent[key]; // Delete without checking; non-existent keys are a no-op
        } else {
          // For non-last keys, if the next level doesn't exist or isn't an object, stop processing
          if (
            typeof safeCurrent[key] !== "object" ||
            safeCurrent[key] === null
          ) {
            return;
          }
          // Move to the next level in the path
          current = safeCurrent[key];
        }
      }
    },
    get<T, P extends string>(object: T, path: P): Get<T, P> {
      const keys = path.split(".");
      let current: unknown = object;

      for (const key of keys) {
        if (!is.object(current) || current === null || !(key in current)) {
          return undefined;
        }
        current = (current as Record<string, unknown>)[key];
      }

      return current as Get<T, P>;
    },
    set<T>(
      object: T,
      path: string,
      value: unknown,
      doNotReplace: boolean = false,
    ): void {
      const keys = path.split(".");
      let current = object as unknown; // Starting with the object as an unknown type

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        // Ensure current can be used as a record in the following operations
        if (typeof current !== "object" || current === null) {
          throw new Error("Attempting to set a value on a non-object.");
        }

        // Safely cast current to Record<string, unknown> after the type guard
        const safeCurrent = current as Record<string, unknown>;

        // For the last key, attempt to set the value
        if (i === keys.length - ARRAY_OFFSET) {
          if (!doNotReplace || !(key in safeCurrent)) {
            safeCurrent[key] = value;
          }
        } else {
          // If the current key does not exist or is not an object, create an object for it
          if (
            safeCurrent[key] === undefined ||
            typeof safeCurrent[key] !== "object" ||
            safeCurrent[key] === null
          ) {
            safeCurrent[key] = {};
          }
          // Move to the next level in the path
          current = safeCurrent[key];
        }
      }
    },
  };
  // #endregion
}

/**
 * ugh, really prom?
 */
type LabelFixer<LABELS extends BaseLabels> = Record<
  Extract<keyof LABELS, string>,
  string | number
>;

type SafeExecOptions<LABELS extends BaseLabels> = {
  exec: () => TBlackHole;
  labels: LABELS;
  duration: Summary<Extract<keyof LABELS, string>>;
  executions: Counter<Extract<keyof LABELS, string>>;
  errors: Counter<Extract<keyof LABELS, string>>;
};

type BaseLabels = {
  context: TContext;
  /**
   * ! if provided, specific metrics will be kept
   *
   * do not pass label if you do not want metrics to be kept, you may not want / need metrics to be kept on all instances
   *
   * - execution count
   * - error count
   * - summary of execution time
   */
  label?: string;
};

type Phase = "bootstrap" | "teardown" | "running";

// #region Base definition
export class InternalDefinition {
  /**
   * Utility methods provided by boilerplate
   */
  public boilerplate: Pick<
    GetApis<typeof LIB_BOILERPLATE>,
    "configuration" | "fetch" | "logger"
  >;
  public boot: {
    /**
     * Options that were passed into bootstrap
     */
    options: BootstrapOptions;

    /**
     * Application that was bootstrapped
     */
    application: ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>;

    /**
     * Lifecycle events that have completed
     */
    completedLifecycleEvents: Set<LifecycleStages>;

    /**
     * for internal operations
     */
    lifecycle: ReturnType<typeof CreateLifecycle>;

    /**
     * Roughly speaking, what's the application doing? Mostly useful for debugging
     */
    phase: Phase;

    /**
     * association of projects to { service : Declaration Function }
     */
    moduleMappings: Map<string, TModuleMappings>;

    /**
     * association of projects to { service : Initialized Service }
     */
    loadedModules: Map<string, TResolvedModuleMappings>;

    /**
     * simple list of modules that have their construction phase complete
     */
    constructComplete: Set<string>;
    startup: Date;
  };
  public utils = new InternalUtils();

  // #MARK: safeExec
  public async safeExec<LABELS extends BaseLabels>(
    options: (() => TBlackHole) | SafeExecOptions<LABELS>,
  ) {
    let labels = {} as BaseLabels;
    let errorMetric: Counter<Extract<keyof LABELS, string>>;
    try {
      if (is.function(options)) {
        await options();
        return;
      }
      const opt = options as SafeExecOptions<LABELS>;
      labels = opt.labels;
      errorMetric = opt.errors;
      const { exec, duration, executions } = opt;
      if (is.empty(labels.label)) {
        await exec();
        return;
      }
      executions?.inc(labels as LabelFixer<LABELS>);
      const end = duration?.startTimer();
      await exec();
      if (end) {
        end(labels as LabelFixer<LABELS>);
      }
    } catch (error) {
      this.boilerplate.logger.systemLogger.error(
        { error, ...labels },
        `callback threw error`,
      );
      if (!is.empty(labels.label)) {
        errorMetric?.inc(labels as LabelFixer<LABELS>);
      }
    }
  }
}
// #endregion
