import dayjs, { Dayjs } from "dayjs";
import { EventEmitter } from "events";
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
  NONE,
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
  public event: EventEmitter;
  constructor() {
    this.event = new EventEmitter();
    this.event.setMaxListeners(NONE);
  }

  public titleCase(input: string): string {
    const matches = input.match(new RegExp("[a-z][A-Z]", "g"));
    if (matches) {
      matches.forEach(i => (input = input.replace(i, [...i].join(" "))));
    }
    return input
      .split(new RegExp("[ _-]"))
      .map(word => `${word.charAt(FIRST).toUpperCase()}${word.slice(EVERYTHING_ELSE)}`)
      .join(" ");
  }

  public relativeDate(pastDate: inputFormats, futureDate: inputFormats = new Date().toISOString()) {
    const UNITS = new Map<Intl.RelativeTimeFormatUnit, number>([
      ["year", YEAR],
      ["month", YEAR / MONTHS],
      ["day", DAY],
      ["hour", HOUR],
      ["minute", MINUTE],
      ["second", SECOND],
    ]);
    const past = dayjs(pastDate);
    if (!past.isValid()) {
      throw new Error("invalid past date " + pastDate);
    }
    const future = dayjs(futureDate);
    if (!future.isValid()) {
      throw new Error("invalid future date " + pastDate);
    }

    const elapsed = past.diff(future, "ms");
    let out = "";

    [...UNITS.keys()].some(unit => {
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
          if (typeof safeCurrent[key] !== "object" || safeCurrent[key] === null) {
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
    set<T>(object: T, path: string, value: unknown, doNotReplace: boolean = false): void {
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

type SafeExecOptions = {
  context?: TContext;
  exec: () => TBlackHole;
};

type Phase = "bootstrap" | "teardown" | "running";

// #region Base definition
export class InternalDefinition {
  /**
   * Utility methods provided by boilerplate
   */
  public boilerplate: Pick<GetApis<typeof LIB_BOILERPLATE>, "configuration" | "logger">;
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
  public async safeExec<T>(options: (() => TBlackHole) | SafeExecOptions): Promise<T> {
    const logger = this.boilerplate.logger.systemLogger;
    const context = is.function(options) ? undefined : options?.context;
    const exec = is.function(options) ? options : options?.exec;
    if (!is.function(exec)) {
      logger.error({ context }, `received non-function callback to [safeExec]`);
      return undefined;
    }
    try {
      return (await exec()) as T;
    } catch (error) {
      logger.error({ context, error }, `callback threw error`);
      return undefined;
    }
  }
}
// #endregion
