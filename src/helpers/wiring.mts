/**
 * @file helpers/wiring.mts — types and pure functions for the DI wiring engine.
 *
 * @remarks
 * This file is the **type backbone** of `@digital-alchemy/core`. It owns
 * `TServiceParams`, `CreateLibrary`, `buildSortOrder`, `wireOrder`, and the
 * two wiring-boundary symbols (`COERCE_CONTEXT`, `WIRE_PROJECT`). Every
 * downstream `@digital-alchemy` library depends on these types.
 *
 * **Split rationale.** This file was deliberately separated from
 * `services/wiring.service.mts` to break a circular module reference that
 * would form if types and the runtime bootstrap logic lived together. Do not
 * merge them. Runtime orchestration (`CreateApplication`, `bootstrap`,
 * `wireService`, `teardown`) lives in `services/wiring.service.mts`; pure
 * types and pure functions live here.
 *
 * **Downstream impact.** Changes to `TServiceParams` shape or to any exported
 * type here ripple into every library. Treat all public exports as breaking
 * surface.
 */

import type { AsyncLocalStorage } from "node:async_hooks";
import type { EventEmitter } from "node:events";

import type { Dayjs } from "dayjs";

import type {
  ConfigManager,
  InternalDefinition,
  LIB_BOILERPLATE,
  RemoveCallback,
} from "../index.mts";
import { is, LOAD_PROJECT } from "../index.mts";
import { eachSeries } from "./async.mts";
import type {
  AnyConfig,
  BooleanConfig,
  DataTypes,
  InternalConfig,
  NumberConfig,
  OptionalModuleConfiguration,
  RecordConfig,
  StringArrayConfig,
  StringConfig,
} from "./config.mts";
import type { TContext } from "./context.mts";
import type { CronExpression, TOffset } from "./cron.mts";
import { BootstrapException } from "./errors.mts";
import type { TLifecycleBase } from "./lifecycle.mts";
import type { GetLogger, TConfigLogLevel } from "./logger.mts";
import { SINGLE, type TBlackHole } from "./utilities.mts";

// --- Primitive service types --------------------------------------------------

/**
 * The value a service factory may return.
 *
 * @remarks
 * A service that returns `void` is wired for its side effects only (e.g.
 * attaching lifecycle hooks). A service that returns an `OBJECT` exposes that
 * object as its public API, accessible to other services via the module's
 * namespace on `TServiceParams`.
 */
export type TServiceReturn<OBJECT extends object = object> = void | OBJECT;

/**
 * Unresolved mapping of service name → factory function within a module.
 *
 * @internal
 */
export type TModuleMappings = Record<string, ServiceFunction>;

/**
 * Resolved mapping of service name → return value after the factory has run.
 *
 * @internal
 */
export type TResolvedModuleMappings = Record<string, TServiceReturn>;

// --- ApplicationConfigurationOptions ------------------------------------------

// #MARK: ApplicationConfigurationOptions
/**
 * Shape of the options object passed to `CreateApplication`.
 *
 * @remarks
 * `name` must be declared in `LoadedModules` via declaration merging so the
 * type system can track which modules are loaded. `services` is the record of
 * service factories that make up the application. `priorityInit` lets callers
 * force specific services to wire before the rest.
 */
export interface ApplicationConfigurationOptions<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> {
  name: keyof LoadedModules;
  services: S;
  libraries?: (LibraryDefinition<ServiceMap, OptionalModuleConfiguration> | LibraryRollup)[];
  configuration?: C;
  /**
   * Define which services should be initialized first. Any remaining services are done at the end in no set order
   */
  priorityInit?: Extract<keyof S, string>[];
}

/**
 * Union of all module definition shapes — either a library or an application.
 *
 * @remarks
 * Used as a generic bound wherever code needs to accept either kind without
 * caring which one it is.
 */
export type TConfigurable<
  S extends ServiceMap = ServiceMap,
  C extends OptionalModuleConfiguration = OptionalModuleConfiguration,
> = LibraryDefinition<S, C> | ApplicationDefinition<S, C>;

/**
 * Type-safe config accessor bound to a specific configurable module.
 *
 * @remarks
 * `K` is constrained to the keys of the config block extracted from `PARENT`,
 * and the return type is the concrete resolved type for that key.
 */
export type TGetConfig<PARENT extends TConfigurable = TConfigurable> = <
  K extends keyof ExtractConfig<PARENT>,
>(
  key: K,
) => CastConfigResult<ExtractConfig<PARENT>[K]>;

/**
 * Maps a `ServiceMap` to the resolved return types of each factory.
 *
 * @remarks
 * Async factories are unwrapped — `Promise<T>` becomes `T`. This is the shape
 * of the API object exposed on `TServiceParams` for a loaded module.
 */
export type GetApisResult<S extends ServiceMap> = {
  [K in keyof S]: ReturnType<S[K]> extends Promise<infer AsyncResult>
    ? AsyncResult
    : ReturnType<S[K]>;
};

/** @internal — extracts the config block from a library or application definition. */
type ExtractConfig<T> =
  T extends LibraryDefinition<ServiceMap, infer C>
    ? C
    : T extends ApplicationDefinition<ServiceMap, infer C>
      ? C
      : never;

// --- Scheduler types ----------------------------------------------------------

/** A cron expression string or a `CronExpression` enum member. */
export type Schedule = string | CronExpression;

/** A runnable item that can be started and stopped. */
export type ScheduleItem = {
  start: () => void;
  stop: () => void;
};

/** Base options required by every scheduler method. */
export type SchedulerOptions = {
  exec: () => TBlackHole;
};

// #MARK: TScheduler
/**
 * General code scheduling functions.
 *
 * @remarks
 * Injected as `scheduler` into every `TServiceParams`. The scheduler is
 * lifecycle-aware — scheduled callbacks do not begin firing until the
 * `onReady` lifecycle stage. Each method returns a `RemoveCallback` so
 * temporary schedules can be torn down without waiting for full shutdown.
 *
 * General code scheduling functions
 *
 * Each method returns a stop function, for temporary scheduling items
 */
export type TScheduler = {
  /**
   * Run code on a cron schedule.
   *
   * @remarks
   * Accepts a single schedule string or an array of schedules to fire `exec`
   * on multiple cron patterns simultaneously.
   *
   * Run code on a cron schedule
   */
  cron: (
    options: SchedulerOptions & {
      schedule: Schedule | Schedule[];
    },
  ) => RemoveCallback;
  /**
   * Run code at a dynamically computed time each period.
   *
   * @remarks
   * Calls `next` at startup and again after each `reset` schedule fires.
   * `next` returns the absolute `Dayjs` of the next desired execution.
   *
   * Run code at a different time every {period}
   *
   * Calls `next` at start, and as determined by `reset`.
   *
   * Next returns the date/time for the next execution
   */
  sliding: (
    options: SchedulerOptions & {
      reset: Schedule;
      next: () => Dayjs;
    },
  ) => RemoveCallback;
  /**
   * Lifecycle-aware `setInterval` replacement.
   *
   * Same as setInterval but:
   *
   * - handles shutdown events properly
   * - won't crash app for errors
   */
  setInterval: (callback: () => TBlackHole, target: TOffset) => RemoveCallback;
  /**
   * Lifecycle-aware `setTimeout` replacement.
   *
   * Same as setTimeout but:
   *
   * - handles shutdown events properly
   * - won't crash app for errors
   */
  setTimeout: (callback: () => TBlackHole, target: TOffset) => RemoveCallback;
};

// --- Module registry ----------------------------------------------------------

/**
 * Registry of all loaded module definitions.
 *
 * @remarks
 * Downstream libraries extend this interface via declaration merging so that
 * `TServiceParams` can expose their APIs under the correct key. The
 * `boilerplate` entry is always present; every other entry is added by a
 * library's declaration merge.
 *
 * @example Declaration merge in a library
 * ```typescript
 * declare module "@digital-alchemy/core" {
 *   export interface LoadedModules {
 *     my_lib: typeof MY_LIB;
 *   }
 * }
 * ```
 */
export interface LoadedModules {
  boilerplate: typeof LIB_BOILERPLATE;
}

/**
 * Registry of library groups — the second declaration-merge channel, parallel
 * to {@link LoadedModules}.
 *
 * @remarks
 * A {@link LibraryGroup} value contributes membership only; an unnamed group
 * never gets its own `LoadedModules` key. To make a group's member APIs visible on
 * {@link TServiceParams} for consumers that import *only the group* (e.g. across a
 * published-`.d.ts` package boundary), the group-defining module augments this
 * interface with an explicit `name → definition` record. The member shapes are
 * inlined into that augmentation, so they travel with the group import — no reliance
 * on each member's own `LoadedModules` merge reaching the consumer.
 *
 * @example Register a named group in the module that defines it
 * ```typescript
 * export const analyticsGroup = LibraryGroup({ members: [LIB_INGEST, LIB_API], name: "analytics" });
 *
 * declare module "@digital-alchemy/core" {
 *   export interface LoadedRollups {
 *     analytics: { ingest: typeof LIB_INGEST; api: typeof LIB_API };
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentionally empty; populated only by downstream declaration merges
export interface LoadedRollups {}

/** @internal — maps a config definition type to its concrete injected value. */
type CastConfigResult<T extends AnyConfig> =
  T extends StringConfig<infer STRING>
    ? STRING
    : T extends BooleanConfig
      ? boolean
      : T extends NumberConfig
        ? number
        : T extends StringArrayConfig
          ? string[]
          : T extends RecordConfig<infer VALUE>
            ? Record<string, VALUE>
            : T extends InternalConfig<infer VALUE>
              ? VALUE
              : never;

/**
 * Compile-time proof that a `record` config injects as `Record<string, V>` and not `never`.
 * If the `RecordConfig` branch above regresses, `ExpectTrue<false>` fails `tsc` (`yarn build`).
 */
type TypeEqual<A, B> =
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- `1`/`2` are the standard sentinel literals of the type-equality idiom
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type ExpectTrue<T extends true> = T;

/** @internal — assertion only; consumed via `export` so `noUnusedLocals` is satisfied. */
export type _RecordConfigCastsToStringRecord = ExpectTrue<
  TypeEqual<CastConfigResult<RecordConfig>, Record<string, string>>
>;

/**
 * The fully-typed config object injected as `config` into `TServiceParams`.
 *
 * @remarks
 * Shaped as `{ [ModuleName]: { [ConfigKey]: ResolvedType } }`. Populated at
 * bootstrap time by the configuration service and kept in sync via the
 * `configSources` loaders.
 */
export type TInjectedConfig = {
  [ModuleName in keyof ModuleConfigs]: ConfigTypes<ModuleConfigs[ModuleName]>;
};

// #region Special
// SEE DOCS http://docs.digital-alchemy.app/docs/core/declaration-merging

/**
 * Per-request data that can be attached to a log entry via ALS.
 *
 * @remarks
 * Extend this interface via declaration merging to attach application-specific
 * fields to every log line emitted within an ALS context.
 *
 * SEE DOCS http://docs.digital-alchemy.app/docs/core/declaration-merging
 */
export interface AsyncLogData {
  /**
   * return ms since entry, precision is on you
   */
  duration?: () => number;
  /**
   * thread local child logger
   */
  logger?: GetLogger;
}

/**
 * Shape of the data stored inside the `AsyncLocalStorage` instance managed by
 * the ALS service.
 *
 * @remarks
 * Extend via declaration merging to carry additional request-scoped fields
 * alongside `logs`.
 */
export interface AsyncLocalData {
  logs: AsyncLogData;
}
// #endregion

/**
 * Public API of the ALS service as injected into `TServiceParams`.
 *
 * @remarks
 * Wraps `AsyncLocalStorage<AsyncLocalData>` with helpers for entering a
 * context, reading the store, and merging per-request log data.
 */
export type AlsExtension = {
  asyncStorage: () => AsyncLocalStorage<AsyncLocalData>;
  getStore: () => AsyncLocalData;
  run(data: AsyncLocalData, callback: () => TBlackHole): void;
  enterWith(data: AsyncLocalData): void;
  getLogData: () => AsyncLogData;
};

/** A function that returns additional data to merge into ALS log context. */
export type AlsHook = () => object;

// #MARK: TServiceParams
/**
 * The single parameter received by every service factory in the DI graph.
 *
 * @remarks
 * `TServiceParams` is the core contract of `@digital-alchemy/core`. There is
 * no class hierarchy, no decorators, no reflection — services are plain
 * functions that destructure the params they need:
 *
 * ```typescript
 * export function MyService({ logger, lifecycle, config }: TServiceParams) {
 *   lifecycle.onReady(() => logger.info("ready"));
 * }
 * ```
 *
 * **Well-known injections:**
 * - `als` — `AsyncLocalStorage` wrapper for per-request context
 * - `context` — branded string describing this service's wiring path
 * - `event` — application-global `EventEmitter`
 * - `internal` — utility methods and boot-state introspection
 * - `lifecycle` — hooks into the seven boot/shutdown stages
 * - `logger` — context-aware logger bound to this service
 * - `scheduler` — cron/interval/sliding scheduling; respects lifecycle
 * - `config` — typed config object; safe to read after `onPostConfig`
 * - `params` — self-reference, useful when passing the full block deeper
 *
 * **Module APIs** are added as additional properties via declaration merging on
 * {@link LoadedModules}. Each loaded library exposes its return value under the
 * library's declared name.
 *
 * **Note:** `TServiceParams` lives in `helpers/wiring.mts`, not in
 * `services/wiring.service.mts`. The split breaks a circular module reference
 * that would form if types and the runtime bootstrap lived together.
 */
export type TServiceParams = {
  /**
   * hooks for AsyncLocalStorage
   */
  als: AlsExtension;
  /**
   * string describing how this service is wired into the main application
   */
  context: TContext;
  /**
   * application global event emitter
   */
  event: EventEmitter;
  /**
   * - utility methods
   * - descriptions of application wiring
   *
   * mostly useful for libraries
   */
  internal: InternalDefinition;
  /**
   * add to the way the application starts / stops
   */
  lifecycle: TLifecycleBase;
  /**
   * context aware logger instance
   */
  logger: GetLogger;
  /**
   * run commands on intervals & schedules
   *
   * respects lifecycle events, not starting to run until the application is ready
   */
  scheduler: TScheduler;
  /**
   * application configuration
   *
   * make sure to use with/after the `onPostConfig` lifecycle event in order to receive user configuration values
   */
  config: TInjectedConfig;
  /**
   * reference to self
   *
   * useful if you want to pass the entire block of params into something deeper
   */
  params: TServiceParams;
} & {
  [K in ExternalLoadedModules]: GetApis<LoadedModules[K]>;
} & Omit<RollupApis, keyof LoadedModules>;

/** Names of all modules registered in `LoadedModules`. */
export type LoadedModuleNames = Extract<keyof LoadedModules, string>;

/** `LoadedModuleNames` minus `"boilerplate"` — the user-land module names. */
type ExternalLoadedModules = Exclude<LoadedModuleNames, "boilerplate">;

/**
 * Collapse a union of object types into a single intersected object.
 *
 * @internal
 */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

/**
 * Member APIs contributed by every registered rollup, merged into one object.
 *
 * @remarks
 * Each {@link LoadedRollups} entry is a `name → definition` record; merging them
 * (a single shared member reached through two rollups collapses here, since the
 * definitions are identical) and resolving each through {@link GetApis} yields the
 * extra properties folded into {@link TServiceParams}. The `[keyof LoadedRollups]
 * extends [never]` guard keeps this `{}` — a true no-op — when no rollup is
 * registered, which is the common case.
 *
 * @internal
 */
type RollupApisOf<T> = [keyof T] extends [never]
  ? // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- no rollups registered → contribute nothing to TServiceParams
    {}
  : {
      [K in keyof UnionToIntersection<T[keyof T]>]: GetApis<UnionToIntersection<T[keyof T]>[K]>;
    };

type RollupApis = RollupApisOf<LoadedRollups>;

/**
 * Compile-time proof that an empty `LoadedRollups` leaves `TServiceParams`
 * untouched. If the `[never]` guard above regresses, `ExpectTrue<false>` fails
 * `tsc` (`yarn build`).
 *
 * @internal — assertion only; consumed via `export` so `noUnusedLocals` is satisfied.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the asserted value IS the empty object
export type _EmptyRollupsContributeNothing = ExpectTrue<TypeEqual<RollupApisOf<{}>, {}>>;

/**
 * Maps each loaded module name to its declared configuration block.
 *
 * @internal
 */
type ModuleConfigs = {
  [K in LoadedModuleNames]: LoadedModules[K] extends LibraryDefinition<ServiceMap, infer Config>
    ? Config
    : LoadedModules[K] extends ApplicationDefinition<ServiceMap, infer Config>
      ? Config
      : never;
};

/**
 * Resolves each key of a config block to its concrete injected type.
 *
 * Now, map these configurations to their respective types using CastConfigResult for each property in the configs
 */
export type ConfigTypes<Config> = {
  [Key in keyof Config]: Config[Key] extends AnyConfig ? CastConfigResult<Config[Key]> : never;
};

/**
 * Maps each loaded module name to its flattened `"module.service"` strings.
 *
 * @remarks
 * Used to build the `levelOverrides` key set in `LoggerOptions` so callers can
 * address per-service log levels with full type safety.
 */
export type ServiceNames<
  T extends Extract<LoadedModuleNames, string> = Extract<LoadedModuleNames, string>,
> = {
  [key in T]: LoadedModules[key] extends LibraryDefinition<infer S, OptionalModuleConfiguration>
    ? `${key}.${Extract<keyof S, string>}`
    : LoadedModules[key] extends ApplicationDefinition<infer S, OptionalModuleConfiguration>
      ? `${key}.${Extract<keyof S, string>}`
      : never;
};

/**
 * Union of all `"module.service"` strings across every loaded module.
 *
 * @remarks
 * Flattened variant of {@link ServiceNames} — the distributed union rather
 * than the mapped object form.
 */
export type FlatServiceNames<
  T extends Extract<LoadedModuleNames, string> = Extract<LoadedModuleNames, string>,
> = {
  [key in T]: LoadedModules[key] extends LibraryDefinition<infer S, OptionalModuleConfiguration>
    ? `${key}.${Extract<keyof S, string>}`
    : LoadedModules[key] extends ApplicationDefinition<infer S, OptionalModuleConfiguration>
      ? `${key}.${Extract<keyof S, string>}`
      : never;
}[T];

/**
 * Extracts the resolved API object type for a loaded module definition.
 *
 * @remarks
 * Used internally to type the per-module properties on `TServiceParams`.
 */
export type GetApis<T> =
  T extends LibraryDefinition<infer S, OptionalModuleConfiguration>
    ? GetApisResult<S>
    : T extends ApplicationDefinition<infer S, OptionalModuleConfiguration>
      ? GetApisResult<S>
      : never;

// export type CastConfigResult<T extends AnyConfig> = T extends StringConfig
//   ? string
//   : T extends BooleanConfig
//     ? boolean
//     : T extends NumberConfig
//       ? number
//       : // Add other mappings as needed
//         unknown;

// export type TModuleInit<S extends ServiceMap> = {
//   /**
//    * Define which services should be initialized first. Any remaining services are done at the end in no set order
//    */
//   priority?: Extract<keyof S, string>[];
// };

/**
 * A function that accepts a service name and returns the resolved API for that
 * service, handling async factories transparently.
 *
 * @internal
 */
export type Loader<PARENT extends TConfigurable> = <K extends keyof PARENT["services"]>(
  serviceName: K,
) => ReturnType<PARENT["services"][K]> extends Promise<infer AsyncResult>
  ? AsyncResult
  : ReturnType<PARENT["services"][K]>;

/**
 * The function signature every service factory must satisfy.
 *
 * @remarks
 * A service receives `TServiceParams` and returns either a value or a
 * `Promise` of a value. The wiring engine awaits async factories before
 * exposing the result to other services.
 */
export type ServiceFunction<R = unknown> = (params: TServiceParams) => R | Promise<R>;

/** A record of service-name → service factory. */
export type ServiceMap = Record<string, ServiceFunction>;

// --- LibraryConfigurationOptions ----------------------------------------------

// #MARK: LibraryConfigurationOptions
/**
 * Shape of the options object passed to `CreateLibrary`.
 *
 * @remarks
 * `name` must match the key declared in `LoadedModules`. `depends` lists
 * libraries that must be wired before this one; `optionalDepends` lists
 * libraries that should be wired first *if* they are present in the
 * application but do not cause a boot failure when absent.
 */
export interface LibraryConfigurationOptions<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> {
  // neat trick, enforcing that they are named the same as they are loaded
  name: keyof LoadedModules;
  services: S;
  /**
   * ensure other libraries get loaded first.
   * only list those that are directly utilized in library
   *
   * - application must declare all dependencies, this is used for validation & determining loading order
   * - warnings will be emitted if this library utilizes a different version of a dependency than what the app uses
   * - version provided by app will be substituted
   */
  depends?: readonly TLibrary[];
  /**
   * Same as depends, but will not error if library is not provided at app level
   *
   * **note**: related variables may come in as undefined, code needs to be built to allow for this
   */
  optionalDepends?: TLibrary[];
  /**
   * Libraries (and/or rollups) this library pulls into application membership when it is
   * loaded — a transitive bundle. Contributes **membership only**, not ordering: the
   * implied libraries are flattened into the resolved set and deduped, so a consumer can
   * carry just this library and the bundle travels with it.
   *
   * Distinct from `depends`: `depends` is ordering + validation; `implies` is membership.
   * Rollups are accepted here and flattened recursively.
   */
  implies?: readonly RollupMember[];
  configuration?: C;
  /**
   * Define which services should be initialized first. Any remaining services are done at the end in no set order
   */
  priorityInit?: Extract<keyof S, string>[];
}

// #MARK: PartialConfiguration
/**
 * Partial snapshot of the full application configuration hierarchy.
 *
 * @remarks
 * Used by `BootstrapOptions.configuration` to supply override values before
 * env/argv/file loaders run, and by the `merge` method on
 * `DigitalAlchemyConfiguration`.
 */
export type PartialConfiguration = Partial<{
  [ModuleName in keyof ModuleConfigs]: Partial<ConfigTypes<ModuleConfigs[ModuleName]>>;
}>;

// #MARK: BootstrapOptions
/**
 * Options passed to `ApplicationDefinition.bootstrap()` to customise the boot
 * sequence.
 *
 * @remarks
 * Most fields have safe defaults and are optional. The most commonly used are:
 * - `configuration` — seed values applied before loaders run
 * - `appendLibrary` / `appendService` — inject test doubles without modifying
 *   the application definition
 * - `configSources` — opt individual loader channels in/out
 * - `loggerOptions` — tune the built-in logger's output format
 */
export type BootstrapOptions = {
  /**
   * An extra library to load after the application is constructed.
   * Can be used to provide testing specific logic
   *
   * If a library collides with a name provided in the application, this version takes priority
   */
  appendLibrary?: TLibrary | TLibrary[];

  /**
   * An services to be appended to the application.
   * Wired as if they were declared with the application, but doesn't come with any related type support
   *
   * Will not collide with existing services, even if context names match
   */
  appendService?: ServiceMap;

  /**
   * Finish the bootstrap sequence for the libraries before loading the application services.
   *
   * - **pro**: easier to write code / you are not affected by lifecycle events
   * - **con**: unable to meaningfully interact with bootstrap lifecycle events if you want to
   *
   * You can change later, but your code may require modifications
   */
  bootLibrariesFirst?: boolean;

  /**
   * default: true
   */
  handleGlobalErrors?: boolean;

  /**
   * default values to use for configurations, before user values come in
   */
  configuration?: PartialConfiguration;

  /**
   * use this logger, instead of the baked in one. Maybe you want some custom transports or something? Put your customized thing here
   */
  customLogger?: GetLogger;

  /**
   * fine tine the built in logger
   */
  loggerOptions?: LoggerOptions;

  /**
   * Show detailed boot time statistics
   */
  showExtraBootStats?: boolean;

  /**
   * Merge configurations from file
   *
   * Default: `.env`
   */
  envFile?: string;

  /**
   * all properties default true if not provided
   */
  configSources?: Partial<Record<DataTypes, boolean>>;
};

// #MARK: LoggerOptions
/**
 * Fine-grained controls for the built-in chalk/stdout logger.
 *
 * @remarks
 * Passed as `loggerOptions` inside `BootstrapOptions`. Overrides here only
 * affect the built-in logger; they are ignored when `customLogger` is
 * provided.
 */
export type LoggerOptions = {
  /**
   * Generic data to include as data payload for all logs
   *
   * Can be used to provide application tags when using a log aggregator
   */
  mergeData?: object;

  /**
   * Adjust the format of the timestamp at the start of the log
   *
   * > default: ddd HH:mm:ss.SSS
   */
  timestampFormat?: string;

  /**
   * Pretty format logs
   *
   * > default: true
   */
  pretty?: boolean;

  /**
   * prefix messages with ms since last message
   *
   * > default: false
   */
  ms?: boolean;

  /**
   * add an incrementing counter to every log.
   * starts at 0 at boot
   *
   * > default: false
   */
  counter?: boolean;

  /**
   * extract details from als module to merge into logs
   *
   * > default: false
   */
  als?: boolean;

  /**
   * Override the `LOG_LEVEL` per service or module
   */
  levelOverrides?: Partial<Record<LoadedModuleNames | FlatServiceNames, TConfigLogLevel>>;

  /**
   * default: true (unless a replacement logger is provided)
   *
   * emit logs to stdout
   */
  stdOut?: boolean;
};

// --- Wiring boundary symbols --------------------------------------------------

/**
 * Symbol used as the key for the `[WIRE_PROJECT]` method on library and
 * application definitions.
 *
 * @remarks
 * This symbol is the wiring boundary between a module definition and the
 * bootstrap engine. `wiring.service.mts` calls `[WIRE_PROJECT]` on each
 * module to initialise its lifecycle, load its configuration, and wire each
 * service in priority order. Do not call `[WIRE_PROJECT]` outside of the
 * bootstrap process.
 *
 * @internal
 */
export const WIRE_PROJECT = Symbol.for("wire-project");

/**
 * Internal wiring method present on every `LibraryDefinition` and
 * `ApplicationDefinition`.
 *
 * @internal
 */
type Wire = {
  /**
   * Internal method used in bootstrapping, do not call elsewhere
   *
   * - initializes lifecycle
   * - attaches event emitters
   */
  [WIRE_PROJECT]: (
    internal: InternalDefinition,
    WireService: (
      project: string,
      service: string,
      definition: ServiceFunction,
      lifecycle: TLifecycleBase,
      internal: InternalDefinition,
    ) => Promise<TServiceReturn<object>>,
  ) => Promise<TLifecycleBase>;
};

// #MARK: LibraryDefinition
/**
 * A fully-constructed library module, ready to be listed in
 * `ApplicationConfigurationOptions.libraries`.
 *
 * @remarks
 * Created by `CreateLibrary`. The `[WIRE_PROJECT]` symbol key is the bootstrap
 * engine's entry point into this module; every other field is readable for
 * introspection but should not be mutated after construction.
 */
export type LibraryDefinition<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
  Implied extends readonly unknown[] = readonly RollupMember[],
  Depends extends readonly TLibrary[] = readonly TLibrary[],
> = Omit<LibraryConfigurationOptions<S, C>, "implies" | "depends"> & {
  /**
   * Captured `implies` tuple. `CreateLibrary` preserves the literal element
   * types here (via a `const` type parameter) so a downstream consumer that
   * imports only this library still has its emitted `.d.ts` reference each
   * implied member by name — carrying the members' own `LoadedModules`
   * augmentations along the import edge.
   *
   * @remarks
   * This is the niche "membership, no ordering edge" escape hatch. Prefer
   * `depends` for ordering + membership. Use `implies` only when you want to
   * bundle a member without creating an ordering constraint.
   */
  implies?: Implied;
  /**
   * Captured `depends` tuple. `CreateLibrary` preserves the literal element
   * types here (via a `const` type parameter) so a downstream consumer that
   * imports only this library still has its emitted `.d.ts` reference each
   * dependency by name — carrying the dependencies' own `LoadedModules`
   * augmentations along the import edge. Also contributes membership: each
   * depended-on library is pulled into the wired set transitively.
   */
  depends?: Depends;
} & Wire & {
    type: "library";
  };

// #MARK: ApplicationDefinition
/**
 * A fully-constructed application module, ready to be bootstrapped.
 *
 * @remarks
 * Created by `CreateApplication` in `services/wiring.service.mts`. Extends the
 * library configuration shape with the `bootstrap` and `teardown` methods, a
 * `booted` flag, and a `logger` pre-bound to the application context.
 */
export type ApplicationDefinition<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = Omit<ApplicationConfigurationOptions<S, C>, "libraries"> &
  Wire & {
    // `libraries` accepts rollups on *input* (ApplicationConfigurationOptions), but the
    // bootstrap flatten pass replaces it with a plain library list before anything reads
    // it for wiring — so the constructed definition exposes the flattened `TLibrary[]`.
    libraries?: LibraryDefinition<ServiceMap, OptionalModuleConfiguration>[];
    logger: GetLogger;
    type: "application";
    booted: boolean;
    bootstrap: (options?: BootstrapOptions) => Promise<TServiceParams>;
    teardown: () => Promise<void>;
  };

/** Convenience alias for a library definition with unknown service/config types. */
export type TLibrary = LibraryDefinition<
  ServiceMap,
  OptionalModuleConfiguration,
  readonly RollupMember[],
  readonly TLibrary[]
>;

// #MARK: LibraryRollup
/**
 * Brand identifying a {@link LibraryRollup} carrier value.
 *
 * @remarks
 * `Symbol.for` (the global registry) is used — like {@link WIRE_PROJECT} — so a
 * rollup produced against one copy of `@digital-alchemy/core` is still recognized
 * by another (duplicate-install / monorepo scenarios).
 *
 * @internal
 */
export const IS_ROLLUP = Symbol.for("digital-alchemy:library-rollup");

/**
 * Bare rollup carrier shape, without member-tuple precision.
 *
 * @remarks
 * Used wherever the precise member tuple is irrelevant — guards and the
 * `libraries` / `implies` element unions. Every {@link LibraryRollup} is assignable
 * to this. Declared as an interface so the `members` self-reference recurses cleanly
 * without the circular-default that a generic alias would hit.
 */
export interface AnyRollup {
  readonly [IS_ROLLUP]: true;
  /** Optional human-readable name for boot diagnostics. A named group earns a `LoadedModules` key. */
  name?: string;
  /** @deprecated use `name` */
  label?: string;
  /** registry-service name for plugin-registry wiring pattern */
  registry?: string;
  members: readonly RollupMember[];
}

/** A library, or a rollup of libraries — the element type composition accepts. */
export type RollupMember = TLibrary | AnyRollup;

/**
 * A composition of libraries, optionally named.
 *
 * @remarks
 * Produced by {@link LibraryGroup}. Accepted anywhere membership is composed
 * (`CreateApplication`'s `libraries`, a library's `implies`). At bootstrap it is
 * flattened into its members and deduped by object identity; it contributes
 * **membership only** — never an ordering edge.
 * Members may themselves be groups (flattened recursively).
 * When `name` is provided, the group earns a `LoadedModules` key and reserves
 * a `config.<name>` namespace.
 */
export type LibraryRollup<M extends readonly RollupMember[] = readonly RollupMember[]> = {
  readonly [IS_ROLLUP]: true;
  name?: string;
  /** @deprecated use `name` */
  label?: string;
  /** registry-service name for plugin-registry wiring pattern */
  registry?: string;
  members: M;
};

// #MARK: LibraryGroup
/**
 * Compose several libraries (and/or other groups) into a membership unit.
 *
 * @remarks
 * The returned value contributes membership only — it adds no ordering edge
 * (ordering stays entirely on each member's own `depends`). List it directly in
 * `CreateApplication({ libraries })` or a library's `implies`.
 *
 * When `name` is provided, the group earns a `LoadedModules` key and reserves
 * a `config.<name>` namespace. To expose member APIs on {@link TServiceParams} for
 * consumers that import only the group across a package boundary, also register the
 * members on {@link LoadedRollups} (see that interface's example).
 *
 * When `registry` is provided, a `priorityInit` registry-service is generated that
 * wires the plugin-registry pattern: a registry service is initialized first, each
 * plugin depends on it, and all plugins are collected into an array.
 *
 * @param options.members - libraries and/or nested groups to compose
 * @param options.name - optional group name; earns a `LoadedModules` key when provided
 * @param options.registry - optional registry-service name for plugin-registry wiring
 */
export function LibraryGroup<const M extends readonly RollupMember[]>({
  members,
  name,
  registry,
}: {
  members: M;
  name?: string;
  registry?: string;
}): LibraryRollup<M> {
  // copy so a caller mutating the passed array can't retroactively alter membership
  const copied = [...members];

  // Plain group (no registry) — membership-only carrier, nothing to synthesize.
  if (is.empty(registry)) {
    return { [IS_ROLLUP]: true, members: copied, name, registry } as unknown as LibraryRollup<M>;
  }

  // A registry-bearing group MUST be named: the synthesized carrier library needs a
  // `LoadedModules` key so each member can read `parent.<carrier>.<registry>` and the
  // app can introspect it. A nameless registry has nowhere to live.
  if (is.empty(name)) {
    throw new BootstrapException(
      WIRING_CONTEXT,
      "REGISTRY_REQUIRES_NAME",
      "LibraryGroup({ registry }) requires a `name`; the registry service is exposed on the carrier library named after the group.",
    );
  }

  // Synthesize the carrier library that hosts the registry service. The registry service
  // is declared in `priorityInit` so it is constructed BEFORE any sibling that
  // construction-reads it — priorityInit is the intra-module boot contract. Cross-module
  // consumers (the members) order via their own `depends: [carrier]` edge, NOT priorityInit.
  const carrier = makeRegistryCarrier(name, registry);

  // Each member carries `depends: [carrier]` so DA constructs the carrier (incl. its
  // priorityInit'd registry) before the member's factory runs. This is the cross-module
  // ordering guarantee. Members are shallow-cloned so the shared source object is never
  // mutated; the carrier is appended to (not replacing) any existing depends.
  const wrapped = copied.map(member => addCarrierDepends(member, carrier));

  // carrier first so it is obviously the construction root of the group
  return {
    [IS_ROLLUP]: true,
    members: [carrier, ...wrapped],
    name,
    registry,
  } as unknown as LibraryRollup<M>;
}

/**
 * The public API of a generated registry service.
 *
 * @remarks
 * `register(item)` collects an item into a factory-closure array; `list()` returns the
 * accumulated items. Members register via `lifecycle.onPreInit(() => parent.<registry>.register(...))`
 * (never at module scope, never in `onBootstrap`); a consumer reads via `list()`.
 */
export type RegistryService<ITEM = unknown> = {
  register: (item: ITEM) => void;
  list: () => ITEM[];
};

/**
 * Build the synthesized carrier `LibraryDefinition` for a registry-bearing group.
 *
 * @remarks
 * One service — the registry — declared in `priorityInit` so it constructs before any
 * sibling that construction-reads it. The registry collects into an array held in factory
 * closure and exposes `register` / `list`.
 *
 * @internal
 */
function makeRegistryCarrier(name: string, registry: string): TLibrary {
  const registryService: ServiceFunction<RegistryService> = () => {
    const items: unknown[] = [];
    return {
      list: () => [...items],
      register: (item: unknown) => {
        items.push(item);
      },
    };
  };
  return CreateLibrary({
    name: name as keyof LoadedModules,
    priorityInit: [registry],
    services: { [registry]: registryService },
  }) as unknown as TLibrary;
}

/**
 * Return a shallow clone of `member` with `carrier` appended to its `depends`, leaving the
 * source object untouched. Groups passed as members are recursed into so every leaf library
 * gains the carrier dependency.
 *
 * @internal
 */
function addCarrierDepends(member: RollupMember, carrier: TLibrary): RollupMember {
  if (isRollup(member)) {
    return {
      ...member,
      members: member.members.map(inner => addCarrierDepends(inner, carrier)),
    } as AnyRollup;
  }
  const existing = member.depends ?? [];
  // identity dedup: don't double-add the carrier if already depended upon
  const depends = existing.includes(carrier) ? existing : [...existing, carrier];
  return { ...member, depends } as TLibrary;
}

/** Type guard: is this value a rollup carrier rather than a library? */
export function isRollup(value: unknown): value is AnyRollup {
  return is.object(value) && (value as Record<symbol, unknown>)[IS_ROLLUP] === true;
}

// #MARK: flattenLibraries
/**
 * Provenance of a flattened membership set — which path(s) brought each library in.
 *
 * @remarks
 * Surfaced on the boot manifest (`showExtraBootStats`) and used to emit the
 * multi-path hygiene warning.
 */
export type RollupProvenance = {
  /** resolved library name → the distinct paths by which it entered membership */
  paths: Map<string, string[]>;
  /** names that entered via more than one distinct path (diamond / over-declaration) */
  multiPath: string[];
  /**
   * Libraries pulled into membership *only* by closure (a `depends` edge of another
   * library) and never listed at the top level. Maps the auto-pulled library's name →
   * the name of the library whose `depends` first pulled it in (its puller).
   *
   * Load-bearing for the boot log: the app's listed `libraries` array no longer equals
   * the wired set, so every closure-pulled library must be narrated with its puller.
   */
  autoPulled: Map<string, string>;
};

/**
 * Expand groups, `implies` bundles, and transitive `depends` into a flat,
 * identity-deduped `TLibrary[]`.
 *
 * @remarks
 * Membership only — ordering is untouched (it stays on each member's own `depends`
 * and is decided later by {@link buildSortOrder}). Dedup is by **object identity**
 * for explicitly listed members; closure-pulled deps (via `depends`) also skip if a
 * library with the same name is already in the output — this lets an explicitly-listed
 * library (or an appendLibrary replacement) take precedence over an auto-pulled dep.
 * A same-name / different-object pair that was NOT resolved by closure is still
 * rejected downstream by `assertLibraryNames` (`DUPLICATE_LIBRARY`).
 *
 * @throws {BootstrapException} `COMPOSITION_CYCLE` when a group transitively contains
 * itself, or a `depends`/`implies` chain forms a cycle.
 */
export function flattenLibraries(declared: readonly RollupMember[]): {
  libraries: TLibrary[];
  provenance: RollupProvenance;
} {
  const out: TLibrary[] = [];
  const seen = new Set<TLibrary>(); // identity dedup
  const paths = new Map<string, string[]>();
  const autoPulled = new Map<string, string>(); // closure-pulled lib name → puller name
  const visiting = new Set<unknown>(); // active expansion stack (cycle guard)

  // Pre-collect all names of libraries that appear directly in `declared` (top-level,
  // not via closure). These names take priority — a closure-pulled dep with the same
  // name is silently skipped so that an explicit listing or appendLibrary substitution wins.
  const explicitNames = new Set<string>();
  const visitedInPreScan = new Set<unknown>();
  function collectExplicitNames(members: readonly RollupMember[]) {
    for (const entry of members) {
      if (isRollup(entry)) {
        if (visitedInPreScan.has(entry)) {
          continue; // cycle guard — the actual cycle error fires during the main traversal
        }
        visitedInPreScan.add(entry);
        collectExplicitNames(entry.members);
      } else {
        explicitNames.add(String(entry.name));
      }
    }
  }
  collectExplicitNames(declared);

  const note = (name: string, path: string) => {
    const list = paths.get(name) ?? [];
    list.push(path);
    paths.set(name, list);
  };

  // function declarations (hoisted) so the mutual recursion needs no forward-declare
  function addLibrary(lib: TLibrary, path: string, fromClosure = false, puller?: string) {
    note(lib.name, path);
    if (visiting.has(lib)) {
      // lib is an ancestor on the active stack — a genuine cycle
      throw new BootstrapException(
        WIRING_CONTEXT,
        "COMPOSITION_CYCLE",
        `dependency cycle detected at [${lib.name}]`,
      );
    }
    if (seen.has(lib)) {
      return; // already in membership via another path — dedup, keep the first object
    }
    // Closure-pulled deps defer to any explicitly listed library with the same name.
    // This allows appendLibrary / replaceLibrary substitutions to win over auto-pulled originals.
    if (fromClosure && explicitNames.has(String(lib.name))) {
      return;
    }
    // narration provenance: a library reached only by closure (not listed top-level) is
    // auto-pulled — record its puller so the boot log can name who brought it in. First
    // closure puller wins; a later top-level/explicit appearance is not auto-pulled.
    if (fromClosure && !explicitNames.has(String(lib.name)) && !autoPulled.has(lib.name)) {
      autoPulled.set(lib.name, puller ?? "(unknown)");
    }
    visiting.add(lib);
    // depends contributes membership (closure-as-membership): walk deps before placing
    // this library so dependencies always appear earlier in out[] than their dependents
    const deps = lib.depends ?? [];
    if (!is.empty(deps)) {
      deps.forEach(dep =>
        addLibrary(dep as TLibrary, `${path} -> depends(${lib.name})`, true, lib.name),
      );
    }
    // Now place lib itself (after its deps are already in out[])
    seen.add(lib);
    out.push(lib);
    // implies contributes membership AFTER the implier is placed; ordering is irrelevant
    const implied = lib.implies ?? [];
    if (!is.empty(implied)) {
      implied.forEach(member => visit(member, `${path} -> implies(${lib.name})`));
    }
    visiting.delete(lib);
  }

  function visit(entry: RollupMember, path: string) {
    if (isRollup(entry)) {
      if (visiting.has(entry)) {
        // eslint-disable-next-line sonarjs/deprecation -- reading deprecated `label` for backward compat with old rollup objects
        const id = entry.name ?? entry.label;
        const where = id ? ` at [${id}]` : "";
        throw new BootstrapException(
          WIRING_CONTEXT,
          "COMPOSITION_CYCLE",
          `group cycle detected${where}`,
        );
      }
      visiting.add(entry);
      // eslint-disable-next-line sonarjs/deprecation -- reading deprecated `label` for backward compat with old rollup objects
      const label = entry.name ?? entry.label ?? "group";
      entry.members.forEach(member => visit(member, `${path} -> group(${label})`));
      visiting.delete(entry);
      return;
    }
    addLibrary(entry, path);
  }

  declared.forEach((entry, index) => {
    if (isRollup(entry)) {
      visit(entry, entry.name ? `group(${entry.name})` : `group#${index}`);
    } else {
      visit(entry, `libraries[${entry.name}]`);
    }
  });

  const multiPath = [...paths.entries()]
    .filter(([, list]) => is.unique(list).length > SINGLE)
    .map(([name]) => name);

  return { libraries: out, provenance: { autoPulled, multiPath, paths } };
}

// #MARK: buildSortOrder
/**
 * Topologically sort the libraries declared by an application so that each
 * library's dependencies are wired before it.
 *
 * @remarks
 * Uses a simple iterative approach: on each pass, pick the first library whose
 * required dependencies have all already been placed in `out`, then remove it
 * from the working set. Optional dependencies that are not present in the
 * application's library list are skipped rather than causing a failure.
 *
 * Version mismatches (same name, different object reference) emit a warning
 * but do not block boot — the application-declared version wins.
 *
 * @throws {BootstrapException} `MISSING_DEPENDENCY` when a required dependency
 * is not listed in the application's `libraries` array.
 * @throws {BootstrapException} `BAD_SORT` when no progress can be made —
 * usually indicates a circular dependency.
 */
export function buildSortOrder<S extends ServiceMap, C extends OptionalModuleConfiguration>(
  app: ApplicationDefinition<S, C>,
  logger: GetLogger,
) {
  // fast path — nothing to sort when no libraries are declared
  if (is.empty(app.libraries)) {
    return [];
  }
  const libraryMap = new Map<string, TLibrary>(app.libraries.map(i => [i.name, i]));

  // Recursive function to check for missing dependencies at any depth
  function checkDependencies(library: TLibrary) {
    const depends = [...(library?.depends ?? []), ...(library?.optionalDepends ?? [])];
    if (!is.empty(depends)) {
      depends.forEach(item => {
        const loaded = libraryMap.get(item.name);
        if (!loaded) {
          if (library.depends.includes(item)) {
            throw new BootstrapException(
              WIRING_CONTEXT,
              "MISSING_DEPENDENCY",
              `${item.name} is required by ${library.name}, but was not provided`,
            );
          } else {
            logger.info(
              { library: library.name, name: checkDependencies },
              `optional depends [%s] not provided`,
              item.name,
            );
            return;
          }
        }
        // just "are they the same object reference?" as the test
        // you get a warning, and the one the app asks for
        // hopefully there is no breaking changes
        if (loaded !== item && !process.env.NODE_ENV?.startsWith("test")) {
          logger.warn(
            { name: buildSortOrder },
            "[%s] depends different version {%s}",
            library.name,
            item.name,
          );
        }
      });
    }
    return library;
  }

  let starting = app.libraries.map(i => checkDependencies(i));
  const out = [] as TLibrary[];
  while (!is.empty(starting)) {
    const next = starting.find(library => {
      const depends = [
        ...(library?.depends ?? []),
        ...(library?.optionalDepends?.filter(i =>
          app.libraries.some(index => i.name === index.name),
        ) ?? []),
      ];
      // a library with no remaining unsatisfied dependencies can go next
      if (is.empty(depends)) {
        return true;
      }
      return depends.every(depend => out.some(i => i.name === depend.name));
    });
    if (!next) {
      logger.fatal({ current: out.map(i => i.name), name: buildSortOrder });
      throw new BootstrapException(WIRING_CONTEXT, "BAD_SORT", `Cannot find a next lib to load`);
    }
    starting = starting.filter(i => next.name !== i.name);
    out.push(next);
  }
  return out;
}

/**
 * Cast a plain string to the branded `TContext` type.
 *
 * @remarks
 * Used at the wiring boundary to produce context strings without importing the
 * `TContext` brand into every caller. Prefer descriptive names like
 * `"boilerplate:wiring"` over opaque identifiers so logs are readable.
 *
 * @internal
 */
export const COERCE_CONTEXT = (context: string): TContext => context as TContext;

/**
 * Fixed context string used for all errors and log messages emitted during the
 * wiring phase itself.
 *
 * @internal
 */
export const WIRING_CONTEXT = COERCE_CONTEXT("boilerplate:wiring");

// #MARK: validateLibrary
/**
 * Assert that a library name and service map meet the minimum requirements to
 * be wired.
 *
 * @remarks
 * Called by `CreateLibrary` before any other work. Throws immediately if the
 * name is empty or if any entry in `serviceList` is not a function, so
 * misconfiguration surfaces at library-construction time rather than at wire
 * time.
 *
 * @throws {BootstrapException} `MISSING_LIBRARY_NAME` when `project` is empty.
 * @throws {BootstrapException} `INVALID_SERVICE_DEFINITION` when any service is not a function.
 *
 * @internal
 */
export function validateLibrary<S extends ServiceMap>(
  project: string,
  serviceList: S,
): void | never {
  if (is.empty(project)) {
    throw new BootstrapException(
      COERCE_CONTEXT("CreateLibrary"),
      "MISSING_LIBRARY_NAME",
      "Library name is required",
    );
  }
  const services = Object.entries(serviceList);

  // Find the first invalid service
  const invalidService = services.find(([, definition]) => typeof definition !== "function");
  if (invalidService) {
    const [invalidServiceName, service] = invalidService;
    throw new BootstrapException(
      COERCE_CONTEXT("CreateLibrary"),
      "INVALID_SERVICE_DEFINITION",
      `Invalid service definition for '${invalidServiceName}' in library '${project}' (${typeof service}})`,
    );
  }
}

// #MARK: wireOrder
/**
 * Produce a wiring order for a service list, hoisting `priority` items to the
 * front and appending the remainder in their original order.
 *
 * @remarks
 * Validates that `priority` contains no duplicates before merging, since a
 * service wired twice would produce subtle bugs that are hard to diagnose at
 * runtime.
 *
 * @throws {BootstrapException} `DOUBLE_PRIORITY` when `priority` contains
 * duplicate service names.
 */
export function wireOrder<T extends string>(priority: T[], list: T[]): T[] {
  const out = [...(priority || [])];
  if (!is.empty(priority)) {
    const check = is.unique(priority);
    // duplicate entries in priorityInit would wire the same service twice
    if (check.length !== out.length) {
      throw new BootstrapException(
        WIRING_CONTEXT,
        "DOUBLE_PRIORITY",
        "There are duplicate items in the priority load list",
      );
    }
  }
  const temporary = [...out, ...list.filter(i => !out.includes(i))];
  return temporary;
}

// #MARK: CreateLibrary
/**
 * Construct a `LibraryDefinition` from a configuration options object.
 *
 * @remarks
 * `CreateLibrary` is the public factory for all non-application modules. It
 * validates the name and service map, then builds the `[WIRE_PROJECT]`
 * implementation that the bootstrap engine calls to wire each service in order.
 *
 * **Lifecycle hook timing.** Services should attach all lifecycle hooks at the
 * top level of their factory function. Hooks attached after the
 * `[WIRE_PROJECT]` call completes will be silently lost (worst case) or cause
 * a fatal error (best case).
 *
 * **Priority init.** `priorityInit` services are wired before all others in
 * declaration order. The remaining services wire in no guaranteed order.
 *
 * @throws {BootstrapException} `MISSING_LIBRARY_NAME` — via `validateLibrary`.
 * @throws {BootstrapException} `INVALID_SERVICE_DEFINITION` — via `validateLibrary`.
 * @throws {BootstrapException} `MISSING_PRIORITY_SERVICE` when a name listed in
 * `priorityInit` does not correspond to a service in the `services` map.
 */
export function CreateLibrary<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
  const Implied extends readonly RollupMember[] = readonly [],
  const Depends extends readonly TLibrary[] = readonly [],
>({
  name: libraryName,
  configuration = {} as C,
  priorityInit,
  services,
  depends,
  optionalDepends,
  implies,
  ...extra
}: LibraryConfigurationOptions<S, C> & {
  implies?: Implied;
  depends?: Depends;
}): LibraryDefinition<S, C, Implied, Depends> {
  validateLibrary(libraryName, services);

  const serviceApis = {} as GetApisResult<ServiceMap>;

  if (!is.empty(priorityInit)) {
    priorityInit.forEach(name => {
      if (!is.function(services[name])) {
        // fail fast at library-construction time; catching this at wire time is much harder to debug
        throw new BootstrapException(
          WIRING_CONTEXT,
          "MISSING_PRIORITY_SERVICE",
          `${name} was listed as priority init, but was not found in services`,
        );
      }
    });
  }

  const library = {
    // * Merge in stuff which may only exist via declaration merging
    ...extra,
    [WIRE_PROJECT]: async (
      internal: InternalDefinition,
      WireService: (
        project: string,
        service: string,
        definition: ServiceFunction,
        lifecycle: TLifecycleBase,
        internal: InternalDefinition,
      ) => Promise<TServiceReturn<object>>,
    ) => {
      // not defined for boilerplate (chicken & egg)
      // manually added inside the bootstrap process
      const config = internal?.boilerplate.configuration as ConfigManager;
      config?.[LOAD_PROJECT](libraryName as keyof LoadedModules, configuration);
      await eachSeries(wireOrder(priorityInit, Object.keys(services)), async service => {
        serviceApis[service] = await WireService(
          libraryName,
          service,
          services[service],
          internal.boot.lifecycle.events,
          internal,
        );
      });
      internal.boot.constructComplete.add(libraryName);
      // mental note: people should probably do all their lifecycle attachments at the base level function
      // otherwise, it'll happen after this wire() call, and go into a black hole (worst case) or fatal error ("best" case)
    },
    configuration,
    depends,
    implies,
    name: libraryName,
    optionalDepends,
    priorityInit,
    serviceApis,
    services,
    type: "library",
  } as unknown as LibraryDefinition<S, C, Implied, Depends>;
  return library;
}
