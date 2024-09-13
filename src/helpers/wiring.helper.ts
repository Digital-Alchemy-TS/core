import { AsyncLocalStorage } from "async_hooks";
import { Dayjs } from "dayjs";
import { EventEmitter } from "events";

import {
  BootstrapException,
  ConfigManager,
  CronExpression,
  eachSeries,
  ILogger,
  InternalDefinition,
  is,
  LIB_BOILERPLATE,
  LOAD_PROJECT,
  TBlackHole,
  TContext,
} from "..";
import {
  AnyConfig,
  BooleanConfig,
  ConfigLoader,
  InternalConfig,
  NumberConfig,
  OptionalModuleConfiguration,
  StringArrayConfig,
  StringConfig,
} from "./config.helper";
import { TLifecycleBase } from "./lifecycle.helper";

export type TServiceReturn<OBJECT extends object = object> = void | OBJECT;

export type TModuleMappings = Record<string, ServiceFunction>;
export type TResolvedModuleMappings = Record<string, TServiceReturn>;

// #MARK: ApplicationConfigurationOptions
export type ApplicationConfigurationOptions<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = {
  configurationLoaders?: ConfigLoader[];
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
};

// #MARK: TScheduler
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

export interface AsyncLocalData {
  id: string;
}

export type AlsExtension = {
  asyncStorage: () => AsyncLocalStorage<AsyncLocalData>;
  getStore: () => AsyncLocalData;
  init(callback: () => TBlackHole): void;
  register(callback: AlsHook): void;
};
export type AlsHook = () => object;

// #MARK: TServiceParams
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
  logger: ILogger;
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
} & {
  [K in ExternalLoadedModules]: GetApis<LoadedModules[K]>;
};

type LoadedModuleNames = Extract<keyof LoadedModules, string>;

type ExternalLoadedModules = Exclude<LoadedModuleNames, "boilerplate">;

type ModuleConfigs = {
  [K in LoadedModuleNames]: LoadedModules[K] extends LibraryDefinition<
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

// #MARK: LibraryConfigurationOptions
export type LibraryConfigurationOptions<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = {
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
  depends?: TLibrary[];
  /**
   * Same as depends, but will not error if library is not provided at app level
   *
   * **note**: related variables may come in as undefined, code needs to be built to allow for this
   */
  optionalDepends?: TLibrary[];
  configuration?: C;
  /**
   * Define which services should be initialized first. Any remaining services are done at the end in no set order
   */
  priorityInit?: Extract<keyof S, string>[];
};

export type PartialConfiguration = Partial<{
  [ModuleName in keyof ModuleConfigs]: Partial<
    ConfigTypes<ModuleConfigs[ModuleName]>
  >;
}>;

// #MARK: BootstrapOptions
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
  customLogger?: ILogger;

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
};

export type LoggerOptions = {
  /**
   * > default: ddd HH:mm:ss.SSS
   */
  timestamp_format?: string;
};

export const WIRE_PROJECT = Symbol.for("wire-project");

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

export type LibraryDefinition<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = LibraryConfigurationOptions<S, C> & Wire;

export type ApplicationDefinition<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = ApplicationConfigurationOptions<S, C> &
  Wire & {
    logger: ILogger;
    booted: boolean;
    bootstrap: (options?: BootstrapOptions) => Promise<void>;
    teardown: () => Promise<void>;
  };
export type TLibrary = LibraryDefinition<
  ServiceMap,
  OptionalModuleConfiguration
>;

export function BuildSortOrder<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>(app: ApplicationDefinition<S, C>, logger: ILogger) {
  if (is.empty(app.libraries)) {
    return [];
  }
  const libraryMap = new Map<string, TLibrary>(
    app.libraries.map((i) => [i.name, i]),
  );

  // Recursive function to check for missing dependencies at any depth
  function checkDependencies(library: TLibrary) {
    const depends = [
      ...(library?.depends ?? []),
      ...(library?.optionalDepends ?? []),
    ];
    if (!is.empty(depends)) {
      depends.forEach((item) => {
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
        if (loaded !== item) {
          logger.warn(
            { name: BuildSortOrder },
            "[%s] depends different version {%s}",
            library.name,
            item.name,
          );
        }
      });
    }
    return library;
  }

  let starting = app.libraries.map((i) => checkDependencies(i));
  const out = [] as TLibrary[];
  while (!is.empty(starting)) {
    const next = starting.find((library) => {
      const depends = [
        ...(library?.depends ?? []),
        ...(library?.optionalDepends?.filter((i) =>
          app.libraries.some((index) => i.name === index.name),
        ) ?? []),
      ];
      if (is.empty(depends)) {
        return true;
      }
      return depends.every((depend) => out.some((i) => i.name === depend.name));
    });
    if (!next) {
      logger.fatal({ current: out.map((i) => i.name), name: BuildSortOrder });
      throw new BootstrapException(
        WIRING_CONTEXT,
        "BAD_SORT",
        `Cannot find a next lib to load`,
      );
    }
    starting = starting.filter((i) => next.name !== i.name);
    out.push(next);
  }
  return out;
}

export const COERCE_CONTEXT = (context: string): TContext =>
  context as TContext;
export const WIRING_CONTEXT = COERCE_CONTEXT("boilerplate:wiring");

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
  const invalidService = services.find(
    ([, definition]) => typeof definition !== "function",
  );
  if (invalidService) {
    const [invalidServiceName, service] = invalidService;
    throw new BootstrapException(
      COERCE_CONTEXT("CreateLibrary"),
      "INVALID_SERVICE_DEFINITION",
      `Invalid service definition for '${invalidServiceName}' in library '${project}' (${typeof service}})`,
    );
  }
}

export function wireOrder<T extends string>(priority: T[], list: T[]): T[] {
  const out = [...(priority || [])];
  if (!is.empty(priority)) {
    const check = is.unique(priority);
    if (check.length !== out.length) {
      throw new BootstrapException(
        WIRING_CONTEXT,
        "DOUBLE_PRIORITY",
        "There are duplicate items in the priority load list",
      );
    }
  }
  const temporary = [...out, ...list.filter((i) => !out.includes(i))];
  return temporary;
}

export function CreateLibrary<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>({
  name: libraryName,
  configuration = {} as C,
  priorityInit,
  services,
  depends,
  optionalDepends,
}: LibraryConfigurationOptions<S, C>): LibraryDefinition<S, C> {
  validateLibrary(libraryName, services);

  const serviceApis = {} as GetApisResult<ServiceMap>;

  if (!is.empty(priorityInit)) {
    priorityInit.forEach((name) => {
      if (!is.function(services[name])) {
        throw new BootstrapException(
          WIRING_CONTEXT,
          "MISSING_PRIORITY_SERVICE",
          `${name} was listed as priority init, but was not found in services`,
        );
      }
    });
  }

  const library = {
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
      await eachSeries(
        wireOrder(priorityInit, Object.keys(services)),
        async (service) => {
          serviceApis[service] = await WireService(
            libraryName,
            service,
            services[service],
            internal.boot.lifecycle.events,
            internal,
          );
        },
      );
      internal.boot.constructComplete.add(libraryName);
      // mental note: people should probably do all their lifecycle attachments at the base level function
      // otherwise, it'll happen after this wire() call, and go into a black hole (worst case) or fatal error ("best" case)
    },
    configuration,
    depends,
    name: libraryName,
    optionalDepends,
    priorityInit,
    serviceApis,
    services,
  } as unknown as LibraryDefinition<S, C>;
  return library;
}
