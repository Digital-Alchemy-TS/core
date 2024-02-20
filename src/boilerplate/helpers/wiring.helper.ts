import { Dayjs } from "dayjs";
import { EventEmitter } from "events";
import { Logger } from "pino";

import { CronExpression, TBlackHole, TContext } from "../..";
import { ILogger, LIB_BOILERPLATE, TCache } from "..";
import {
  AnyConfig,
  BooleanConfig,
  InternalConfig,
  NumberConfig,
  OptionalModuleConfiguration,
  StringArrayConfig,
  StringConfig,
} from "./config.helper";
import { TChildLifecycle, TLifecycleBase } from "./lifecycle.helper";

export type TServiceReturn<OBJECT extends object = object> = void | OBJECT;

export type TModuleMappings = Record<string, ServiceFunction>;
export type TResolvedModuleMappings = Record<string, TServiceReturn>;

export type ApplicationConfigurationOptions<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = {
  name: keyof LoadedModules;
  services: S;
  libraries?: LibraryDefinition<ServiceMap, OptionalModuleConfiguration>[];
  configuration?: C;
  /**
   * Define which services should be initialized first. Any remaining services are done at the end in no set order
   */
  priorityInit?: Extract<keyof S, string>[];
};

export type TConfigurable<
  S extends ServiceMap = ServiceMap,
  C extends OptionalModuleConfiguration = OptionalModuleConfiguration,
> = LibraryDefinition<S, C> | ApplicationDefinition<S, C>;

export type TGetConfig<PARENT extends TConfigurable = TConfigurable> = <
  K extends keyof ExtractConfig<PARENT>,
>(
  key: K,
) => CastConfigResult<ExtractConfig<PARENT>[K]>;

export type GetApisResult<S extends ServiceMap> = {
  [K in keyof S]: ReturnType<S[K]> extends Promise<infer AsyncResult>
    ? AsyncResult
    : ReturnType<S[K]>;
};

type ExtractConfig<T> =
  T extends LibraryDefinition<ServiceMap, infer C>
    ? C
    : T extends ApplicationDefinition<ServiceMap, infer C>
      ? C
      : never;

export type Schedule = string | CronExpression;
export type ScheduleItem = {
  start: () => void;
  stop: () => void;
};
export type SchedulerOptions = {
  exec: () => TBlackHole;
  /**
   * if provided, specific metrics will be kept and labelled with provided label
   *
   * - execution count
   * - errors
   * - execution duration
   */
  label?: string;
};

/**
 * General code scheduling functions
 *
 * Each method returns a stop function, for temporary scheduling items
 */
export type TScheduler = {
  /**
   * Run code on a cron schedule
   */
  cron: (
    options: SchedulerOptions & {
      schedule: Schedule | Schedule[];
    },
  ) => () => TBlackHole;
  /**
   * Run code on a regular periodic interval
   */
  interval: (
    options: SchedulerOptions & {
      interval: number;
    },
  ) => () => void;
  /**
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
  ) => () => TBlackHole;
};

export interface LoadedModules {
  boilerplate: typeof LIB_BOILERPLATE;
}

type CastConfigResult<T extends AnyConfig> =
  T extends StringConfig<infer STRING>
    ? STRING
    : T extends BooleanConfig
      ? boolean
      : T extends NumberConfig
        ? number
        : T extends StringArrayConfig
          ? string[]
          : T extends InternalConfig<infer VALUE>
            ? VALUE
            : never;

export type TInjectedConfig = {
  [ModuleName in keyof ModuleConfigs]: ConfigTypes<ModuleConfigs[ModuleName]>;
};

export type TServiceParams = {
  cache: TCache;
  context: TContext;
  event: EventEmitter;
  lifecycle: TLifecycleBase;
  logger: ILogger;
  scheduler: TScheduler;
  config: TInjectedConfig;
} & {
  [K in keyof LoadedModules]: GetApis<LoadedModules[K]>;
};

type ModuleConfigs = {
  [K in keyof LoadedModules]: LoadedModules[K] extends LibraryDefinition<
    ServiceMap,
    infer Config
  >
    ? Config
    : LoadedModules[K] extends ApplicationDefinition<ServiceMap, infer Config>
      ? Config
      : never;
};

// Now, map these configurations to their respective types using CastConfigResult for each property in the configs
type ConfigTypes<Config> = {
  [Key in keyof Config]: Config[Key] extends AnyConfig
    ? CastConfigResult<Config[Key]>
    : never;
};

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
export type Loader<PARENT extends TConfigurable> = <
  K extends keyof PARENT["services"],
>(
  serviceName: K,
) => ReturnType<PARENT["services"][K]> extends Promise<infer AsyncResult>
  ? AsyncResult
  : ReturnType<PARENT["services"][K]>;

export type ServiceFunction<R = unknown> = (
  params: TServiceParams,
) => R | Promise<R>;
export type ServiceMap = Record<string, ServiceFunction>;
export type LibraryConfigurationOptions<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = {
  // neat trick, enforcing that they are named the same as they are loaded
  name: keyof LoadedModules;
  services: S;
  configuration?: C;
  /**
   * Define which services should be initialized first. Any remaining services are done at the end in no set order
   */
  priorityInit?: Extract<keyof S, string>[];
};

type onErrorCallback = () => void;
export type PartialConfiguration = Partial<{
  [ModuleName in keyof ModuleConfigs]: Partial<
    ConfigTypes<ModuleConfigs[ModuleName]>
  >;
}>;

export type BootstrapOptions = {
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
  customLogger?: Logger;
  /**
   * application level flags
   */
  flags?: Record<string, boolean | number | string>;
};

export const WIRE_PROJECT = Symbol.for("wire-project");

type Wire = {
  /**
   * Internal method used in bootstrapping, do not call elsewhere
   *
   * - initializes lifecycle
   * - attaches event emitters
   */
  [WIRE_PROJECT]: () => Promise<TChildLifecycle>;
};

export type LibraryDefinition<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = LibraryConfigurationOptions<S, C> &
  Wire & {
    lifecycle: TChildLifecycle;
    onError: (callback: onErrorCallback) => void;
  };

export type ApplicationDefinition<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = ApplicationConfigurationOptions<S, C> &
  Wire & {
    booted: boolean;
    bootstrap: (options?: BootstrapOptions) => Promise<void>;
    lifecycle: TChildLifecycle;
    onError: (callback: onErrorCallback) => void;
    teardown: () => Promise<void>;
  };
