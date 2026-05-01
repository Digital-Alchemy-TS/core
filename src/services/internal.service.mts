import { EventEmitter } from "node:events";

import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { Get } from "type-fest";

import type {
  ApplicationDefinition,
  BootstrapOptions,
  GetApis,
  LifecycleStages,
  OptionalModuleConfiguration,
  ServiceMap,
  TBlackHole,
  TContext,
  TModuleMappings,
  TOffset,
  TResolvedModuleMappings,
} from "../index.mts";
import {
  ARRAY_OFFSET,
  DAY,
  deepExtend,
  FIRST,
  HOUR,
  MINUTE,
  NONE,
  SECOND,
  START,
  toOffsetDuration,
  toOffsetMs,
  YEAR,
} from "../index.mts";
import type { IsIt } from "./is.service.mts";
import { is } from "./is.service.mts";
import type { CreateLifecycle } from "./lifecycle.service.mts";
import type { LIB_BOILERPLATE } from "./wiring.service.mts";

const EVERYTHING_ELSE = 1;
const MONTHS = 12;

const RELATIVE_DATE_UNITS = new Map<Intl.RelativeTimeFormatUnit, number>([
  ["year", YEAR],
  ["month", YEAR / MONTHS],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
  ["second", SECOND],
]);

type inputFormats = Date | string | number | Dayjs;
export type RemoveCallback = { remove: () => void; (): void };

// TODO: probably should make this configurable
const formatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
});

// #MARK: misc
/**
 * Stateless utility bag attached to every `InternalDefinition` instance.
 *
 * @remarks
 * Holds the global `EventEmitter`, the `is` type-guard singleton, and helpers
 * for date math, object path operations, and string formatting.
 * Constructed once per bootstrap cycle; replaced on teardown via a fresh
 * `InternalDefinition`.
 */
export class InternalUtils {
  /**
   * The global eventemitter. All of `@digital-alchemy` will be wired through this.
   *
   * @remarks
   * Bootstrapping process will initialize this at boot and clean it up at
   * teardown. Making listener changes should only be done from within the
   * context of service functions.
   */
  public event: EventEmitter;

  /**
   * Reference to the `is` type-guard singleton importable from `core`.
   */
  public is: IsIt;

  constructor() {
    // unlimited listeners because every service may register lifecycle callbacks,
    // and the default of 10 would fire spurious MaxListenersExceededWarnings
    this.event = new EventEmitter();
    this.event.setMaxListeners(NONE);
  }

  /**
   * Convert a `camelCase`, `snake_case`, or `kebab-case` string to `Title Case`.
   */
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

  /**
   * Compute the target `Dayjs` moment when an offset will elapse.
   */
  getIntervalTarget(offset: TOffset): Dayjs {
    const duration = toOffsetDuration(offset);
    const now = dayjs();
    return duration ? now.add(duration) : now;
  }

  /**
   * Resolve a `TOffset` value to milliseconds.
   */
  getIntervalMs(offset: TOffset): number {
    return toOffsetMs(offset);
  }

  /**
   * Format the elapsed time between two dates as a human-readable relative string.
   *
   * @remarks
   * Iterates unit buckets from largest (year) to smallest (second) and returns
   * the first unit whose cutoff is exceeded. Falls back to "second" when the
   * difference is less than one minute so there is always a non-empty result.
   *
   * @throws {Error} if either date argument cannot be parsed by `dayjs`.
   */
  public relativeDate(pastDate: inputFormats, futureDate: inputFormats = new Date().toISOString()) {
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

    [...RELATIVE_DATE_UNITS.keys()].some(unit => {
      const cutoff = RELATIVE_DATE_UNITS.get(unit);
      if (Math.abs(elapsed) > cutoff || unit == "second") {
        out = formatter.format(Math.round(elapsed / cutoff), unit);
        return true;
      }
      return false;
    });

    return out;
  }

  // #region .object
  /**
   * Dot-path object utilities: `get`, `set`, `del`, and `deepExtend`.
   *
   * @remarks
   * Used throughout core to read and write nested configuration paths like
   * `"boilerplate.LOG_LEVEL"` without assuming the intermediate objects exist.
   */
  public object = {
    deepExtend,
    /**
     * Delete the value at `path` within `object`. Silently no-ops if any
     * intermediate key does not exist.
     */
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
    /**
     * Read the value at `path` within `object`. Returns `undefined` if any
     * intermediate key is missing.
     */
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
    /**
     * Write `value` at `path` within `object`, creating intermediate objects
     * as needed.
     *
     * @remarks
     * When `doNotReplace` is true the write is skipped if the key already
     * has a value — useful for applying defaults without overwriting explicit config.
     *
     * @throws {Error} if an intermediate path segment resolves to a non-object.
     */
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
/**
 * Bootstrap-scoped state container passed as `internal` into every service.
 *
 * @remarks
 * Created fresh on each `bootstrap()` call and torn down with the application.
 * Holds the boot-time module registry (`loadedModules`, `moduleMappings`),
 * the lifecycle event bus, references to boilerplate service APIs, and the
 * `InternalUtils` helper bag.
 *
 * Downstream code should treat `internal` as read-only except for the
 * documented mutation points (`safeExec`, `removeFn`, explicit setters on
 * `boot.*`).
 */
export class InternalDefinition {
  /**
   * Utility methods provided by boilerplate.
   */
  public boilerplate: Pick<GetApis<typeof LIB_BOILERPLATE>, "configuration" | "logger">;
  /**
   * Alias for `internal.boilerplate.configuration`.
   */
  public config: GetApis<typeof LIB_BOILERPLATE>["configuration"];
  public boot: {
    /**
     * Options that were passed into bootstrap.
     */
    options: BootstrapOptions;

    /**
     * Application that was bootstrapped.
     */
    application: ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>;

    /**
     * Lifecycle events that have completed.
     */
    completedLifecycleEvents: Set<LifecycleStages>;

    /**
     * Internal lifecycle event bus; services attach hooks via the injected `lifecycle` param.
     */
    lifecycle: ReturnType<typeof CreateLifecycle>;

    /**
     * Roughly speaking, what is the application doing? Mostly useful for debugging.
     */
    phase: Phase;

    /**
     * Association of project names to `{ service: DeclarationFunction }`.
     */
    moduleMappings: Map<string, TModuleMappings>;

    /**
     * Association of project names to `{ service: InitializedService }`.
     */
    loadedModules: Map<string, TResolvedModuleMappings>;

    /**
     * Simple list of modules that have their construction phase complete.
     */
    constructComplete: Set<string>;
    startup: Date;
    /**
     * Service construction times in order.
     */
    serviceConstructionTimes: Array<{ module: string; service: string; duration: string }>;
    /**
     * Config loader execution times.
     */
    configTimings?: Record<string, string>;
  };
  public utils = new InternalUtils();

  /**
   * Wrap a remove callback so it can be called directly or via `{ remove }` destructuring.
   *
   * @remarks
   * Accommodates callers that prefer either:
   * ```typescript
   * const remove = doThing();
   * // or
   * const { remove } = doThing();
   * ```
   * Both styles are now supported; inconsistency between APIs is intentional.
   */
  public removeFn(remove: () => TBlackHole): RemoveCallback {
    const out = remove as RemoveCallback;
    out.remove = remove;
    return out;
  }

  // #MARK: safeExec
  /**
   * Execute a callback, swallowing and logging any thrown error.
   *
   * @remarks
   * Used throughout scheduler and lifecycle code to ensure that a misbehaving
   * user callback cannot crash the entire wiring engine. Errors are logged at
   * `error` level with full context so they remain visible without being fatal.
   * Returns `undefined` on any error path so callers can treat the return type
   * as optional without extra null-checks.
   */
  public async safeExec<T>(options: (() => TBlackHole) | SafeExecOptions): Promise<T> {
    const logger = this.boilerplate.logger.systemLogger;
    const context = is.function(options) ? undefined : options?.context;
    const exec = is.function(options) ? options : options?.exec;
    // a non-function exec is a programming error, not a runtime error; log and bail
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
