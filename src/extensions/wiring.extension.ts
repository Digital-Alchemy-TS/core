import { EventEmitter } from "events";
import { exit } from "process";
import { Counter, Summary } from "prom-client";

import {
  ApplicationConfigurationOptions,
  ApplicationDefinition,
  BootstrapException,
  BootstrapOptions,
  CallbackList,
  DIGITAL_ALCHEMY_APPLICATION_ERROR,
  DIGITAL_ALCHEMY_LIBRARY_ERROR,
  DOWN,
  each,
  eachSeries,
  GetApisResult,
  LibraryConfigurationOptions,
  LibraryDefinition,
  LIFECYCLE_STAGES,
  LifecycleCallback,
  LifecycleStages,
  LoadedModules,
  OptionalModuleConfiguration,
  ServiceFunction,
  ServiceMap,
  StringConfig,
  TBlackHole,
  TContext,
  TLifecycleBase,
  TLoadableChildLifecycle,
  TModuleMappings,
  TResolvedModuleMappings,
  TScheduler,
  TServiceParams,
  TServiceReturn,
  UP,
  WIRE_PROJECT,
} from "../helpers";
import { InternalDefinition, is, ZCC } from ".";
import { Cache, CacheProviders } from "./cache.extension";
import {
  ConfigManager,
  Configuration,
  INITIALIZE,
  INJECTED_DEFINITIONS,
  LOAD_PROJECT,
} from "./configuration.extension";
import { Fetch } from "./fetch.extension";
import { ILogger, Logger } from "./logger.extension";
import { Scheduler } from "./scheduler.extension";

// # "Semi-local variables"
// These are resettable variables, which are scoped to outside the function on purpose
// If these were moved inside the service function, then re-running the method would result in application / library references being stranded
// Items like lib_boilerplate would still exist, but their lifecycles would be not accessible by the current application
//
// By moving to outside the function, the internal methods will be able to re-initialize as expected, without needing to fully rebuild every reference everywhere
// ... in theory

let completedLifecycleCallbacks = new Set<string>();

/**
 * association of projects to { service : Declaration Function }
 */
const MODULE_MAPPINGS = new Map<string, TModuleMappings>();

/**
 * association of projects to { service : Initialized Service }
 */
const LOADED_MODULES = new Map<string, TResolvedModuleMappings>();

/**
 * Optimized reverse lookups: Declaration  Function => [project, service]
 */
const REVERSE_MODULE_MAPPING = new Map<
  ServiceFunction,
  [project: string, service: string]
>();

const LOADED_LIFECYCLES = new Map<string, TLoadableChildLifecycle>();

/**
 * Details relating to the application that is actively running
 */
let ACTIVE_APPLICATION: ApplicationDefinition<
  ServiceMap,
  OptionalModuleConfiguration
> = undefined;

// heisenberg's variables. it's probably here, but maybe not
let scheduler: (context: TContext) => TScheduler;
let logger: ILogger;
const COERCE_CONTEXT = (context: string): TContext => context as TContext;
const WIRING_CONTEXT = COERCE_CONTEXT("boilerplate:wiring");
const NONE = -1;
// (re)defined at bootstrap
export let LIB_BOILERPLATE: ReturnType<typeof CreateBoilerplate>;
// exporting a let makes me feel dirty inside
// at least it's only for testing

// # Utility

// ## Global shutdown
const processEvents = new Map([
  // ### Shutdown requests
  [
    "SIGTERM",
    async () => {
      logger.warn(`received [SIGTERM]`);
      await Teardown();
      exit();
    },
  ],
  [
    "SIGINT",
    async () => {
      logger.warn(`received [SIGINT]`);
      await Teardown();
      exit();
    },
  ],
  // ### Major application errors
  // ["uncaughtException", () => {}],
  // ["unhandledRejection", (reason, promise) => {}],
]);

// ## Validate Library
function ValidateLibrary<S extends ServiceMap>(
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

// ## LIB_BOILERPLATE
function CreateBoilerplate() {
  return CreateLibrary({
    configuration: {
      CACHE_PREFIX: {
        description: [
          "Use a prefix with all cache keys",
          "If blank, then application name is used",
        ].join(`. `),
        type: "string",
      },
      CACHE_PROVIDER: {
        default: "memory",
        description: "Redis is preferred if available",
        enum: ["redis", "memory"],
        type: "string",
      } as StringConfig<`${CacheProviders}`>,
      CACHE_TTL: {
        default: 86_400,
        description: "Configuration property for cache provider, in seconds",
        type: "number",
      },
      CONFIG: {
        description: [
          "Consumable as CLI switch only",
          "If provided, all other file based configurations will be ignored",
          "Environment variables + CLI switches will operate normally",
        ].join(". "),
        type: "string",
      },
      LOG_LEVEL: {
        default: "trace",
        description: "Minimum log level to process",
        enum: ["silent", "trace", "info", "warn", "debug", "error"],
        type: "string",
      } as StringConfig<keyof ILogger>,
      LOG_METRICS: {
        default: true,
        type: "boolean",
      },
      REDIS_URL: {
        default: "redis://localhost:6379",
        description:
          "Configuration property for cache provider, does not apply to memory caching",
        type: "string",
      },
    },
    name: "boilerplate",
    // > 🐔 🥚 dependencies
    // config system internally resolves this via lifecycle events
    priorityInit: ["configuration", "logger"],
    services: {
      cache: Cache,
      configuration: Configuration,
      fetch: Fetch,
      logger: Logger,
      scheduler: Scheduler,
    },
  });
}

// # Module Creation
function WireOrder<T extends string>(priority: T[], list: T[]): T[] {
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
  return [...out, ...list.filter((i) => !out.includes(i))];
}

const CfgManager = () => ZCC?.config as ConfigManager;

// ## Create Library
export function CreateLibrary<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>({
  name: libraryName,
  configuration,
  priorityInit,
  services,
}: LibraryConfigurationOptions<S, C>): LibraryDefinition<S, C> {
  ValidateLibrary(libraryName, services);

  const lifecycle = CreateChildLifecycle();

  const generated = {} as GetApisResult<ServiceMap>;

  const library = {
    [WIRE_PROJECT]: async (ZCC: InternalDefinition) => {
      // This one hasn't been loaded yet, generate an object with all the correct properties
      LOADED_LIFECYCLES.set(libraryName, lifecycle);
      // not defined for boilerplate (chicken & egg)
      // manually added inside the bootstrap process
      const config = ZCC?.config as ConfigManager;
      config?.[LOAD_PROJECT](libraryName as keyof LoadedModules, configuration);
      await eachSeries(
        WireOrder(priorityInit, Object.keys(services)),
        async (service) => {
          generated[service] = await WireService(
            libraryName,
            service,
            services[service],
            lifecycle,
            ZCC,
          );
        },
      );
      // mental note: people should probably do all their lifecycle attachments at the base level function
      // otherwise, it'll happen after this wire() call, and go into a black hole (worst case) or fatal error ("best" case)
      return lifecycle;
    },
    configuration,
    lifecycle,
    name: libraryName,
    onError: (callback) =>
      ZCC.event.on(DIGITAL_ALCHEMY_LIBRARY_ERROR(libraryName), callback),
    priorityInit,
    services,
  } as LibraryDefinition<S, C>;
  return library;
}

// ## Create Application
export function CreateApplication<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>({
  name,
  services,
  libraries = [],
  configuration = {} as C,
  priorityInit,
}: ApplicationConfigurationOptions<S, C>) {
  const lifecycle = CreateChildLifecycle();
  const application = {
    [WIRE_PROJECT]: async (ZCC: InternalDefinition) => {
      LOADED_LIFECYCLES.set(name, lifecycle);
      CfgManager()[LOAD_PROJECT](name as keyof LoadedModules, configuration);
      await eachSeries(
        WireOrder(priorityInit, Object.keys(services)),
        async (service) => {
          await WireService(name, service, services[service], lifecycle, ZCC);
        },
      );
      return lifecycle;
    },
    booted: false,
    bootstrap: async (options) => {
      if (application.booted) {
        throw new BootstrapException(
          WIRING_CONTEXT,
          "DOUBLE_BOOT",
          "Application is already booted! Cannot bootstrap again",
        );
      }
      await Bootstrap(application, options);
      application.booted = true;
    },
    configuration,
    libraries,
    lifecycle,
    name,
    onError: (callback) =>
      ZCC.event.on(DIGITAL_ALCHEMY_APPLICATION_ERROR, callback),
    priorityInit,
    services,
    teardown: async () => {
      if (!application.booted) {
        logger.error(`application is not booted, cannot teardown`);
        return;
      }
      await Teardown();
      application.booted = false;
    },
  } as ApplicationDefinition<S, C>;
  return application;
}

// # Wiring
// ## Wire Service
async function WireService(
  project: string,
  service: string,
  definition: ServiceFunction,
  lifecycle: TLifecycleBase,
  ZCC: InternalDefinition,
) {
  const mappings = MODULE_MAPPINGS.get(project) ?? {};
  if (!is.undefined(mappings[service])) {
    throw new BootstrapException(
      WIRING_CONTEXT,
      "DUPLICATE_SERVICE_NAME",
      `${service} is already defined for ${project}`,
    );
  }
  mappings[service] = definition;
  MODULE_MAPPINGS.set(project, mappings);
  REVERSE_MODULE_MAPPING.set(definition, [project, service]);
  const context = COERCE_CONTEXT(`${project}:${service}`);

  // logger gets defined first, so this really is only for the start of the start of bootstrapping
  const logger = ZCC.logger ? ZCC.logger.context(context) : undefined;
  const loaded = LOADED_MODULES.get(project) ?? {};
  LOADED_MODULES.set(project, loaded);
  try {
    logger?.trace(`initializing`);
    const config = CfgManager()?.[INJECTED_DEFINITIONS]();
    const inject = Object.fromEntries(
      [...LOADED_MODULES.keys()].map((project) => [
        project as keyof TServiceParams,
        LOADED_MODULES.get(project),
      ]),
    );
    const params: Partial<TServiceParams> = {
      ...inject,
      cache: ZCC.cache,
      config,
      context,
      event: ZCC.event,
      internal: ZCC,
      lifecycle,
      logger,
      scheduler: scheduler && scheduler(context),
    };

    const resolved = (await definition(
      params as TServiceParams,
    )) as TServiceReturn;
    loaded[service] = resolved;
    return resolved;
  } catch (error) {
    // Init errors at this level are considered blocking.
    // Doubling up on errors to be extra noisy for now, might back off to single later
    logger?.fatal({ error, name: context }, `Initialization error`);
    exit();
    return undefined;
  }
}

// ## Run Callbacks
async function RunStageCallbacks(stage: LifecycleStages): Promise<string> {
  const start = Date.now();
  completedLifecycleCallbacks.add(`on${stage}`);
  const list = [
    // boilerplate priority
    LOADED_LIFECYCLES.get("boilerplate").getCallbacks(stage),
    // children next
    // ...
    ...[...LOADED_LIFECYCLES.entries()]
      .filter(([name]) => !["boilerplate", "application"].includes(name))
      .map(([, thing]) => thing.getCallbacks(stage)),
  ];
  await eachSeries(list, async (callbacks) => {
    if (is.empty(callbacks)) {
      return;
    }
    const sorted = callbacks.filter(([, sort]) => sort !== NONE);
    const quick = callbacks.filter(([, sort]) => sort === NONE);
    await eachSeries(
      sorted.sort(([, a], [, b]) => (a > b ? UP : DOWN)),
      async ([callback]) => await callback(),
    );
    await each(quick, async ([callback]) => await callback());
  });
  return `${Date.now() - start}ms`;
}

type TLibrary = LibraryDefinition<ServiceMap, OptionalModuleConfiguration>;

function BuildSortOrder<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>(app: ApplicationDefinition<S, C>) {
  if (is.empty(app.libraries)) {
    return [];
  }
  const libraryMap = new Map<string, TLibrary>(
    app.libraries.map((i) => [i.name, i]),
  );

  // Recursive function to check for missing dependencies at any depth
  function checkDependencies(library: TLibrary) {
    if (!is.empty(library.depends)) {
      library.depends.forEach((item) => {
        const loaded = libraryMap.get(item.name);
        if (!loaded) {
          throw new BootstrapException(
            WIRING_CONTEXT,
            "MISSING_DEPENDENCY",
            `${item.name} is required by ${library.name}, but was not provided`,
          );
        }
        // just "are they the same object reference?" as the test
        // you get a warning, and the one the app asks for
        // hopefully there is no breaking changes
        if (loaded !== item) {
          logger.warn(
            { name: library.name },
            "depends different version [%s]",
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
      if (is.empty(library.depends)) {
        return true;
      }
      return library.depends?.every((depend) =>
        out.some((i) => i.name === depend.name),
      );
    });
    if (!next) {
      logger.fatal({ current: out.map((i) => i.name) });
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

let startup: Date;

// # Lifecycle runners
// ## Bootstrap
async function Bootstrap<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>(application: ApplicationDefinition<S, C>, options: BootstrapOptions) {
  if (ACTIVE_APPLICATION) {
    throw new BootstrapException(
      COERCE_CONTEXT("wiring.extension"),
      "NO_DUAL_BOOT",
      "Another application is already active, please terminate",
    );
  }
  ZCC.bootOptions = options;
  process.title = application.name;
  startup = new Date();
  try {
    const STATS = {} as Record<string, unknown>;
    const CONSTRUCT = {} as Record<string, unknown>;
    STATS.Construct = CONSTRUCT;
    // * Recreate base eventemitter
    ZCC.event = new EventEmitter();
    // ? Some libraries need to be aware of
    ZCC.application = application;

    // * Generate a new boilerplate module
    LIB_BOILERPLATE = CreateBoilerplate();

    // * Wire it
    let start = Date.now();
    await LIB_BOILERPLATE[WIRE_PROJECT](ZCC);
    CONSTRUCT.boilerplate = `${Date.now() - start}ms`;
    // ~ configuration
    CfgManager()[LOAD_PROJECT](
      LIB_BOILERPLATE.name,
      LIB_BOILERPLATE.configuration,
    );
    // ~ scheduler (for injecting into other modules)
    scheduler = LOADED_MODULES.get(LIB_BOILERPLATE.name).scheduler as (
      context: TContext,
    ) => TScheduler;
    logger = ZCC.logger.context(WIRING_CONTEXT);
    logger.info(`[boilerplate] wiring complete`);

    // * Wire in various shutdown events
    processEvents.forEach((callback, event) => {
      process.on(event, callback);
      logger.trace({ event }, "shutdown event");
    });

    // * Add in libraries
    application.libraries ??= [];
    const order = BuildSortOrder(application);
    await eachSeries(order, async (i) => {
      start = Date.now();
      logger.info(`[%s] init project`, i.name);
      await i[WIRE_PROJECT](ZCC);
      CONSTRUCT[i.name] = `${Date.now() - start}ms`;
    });

    logger.info(`init application`);
    // * Finally the application
    start = Date.now();
    await application[WIRE_PROJECT](ZCC);
    CONSTRUCT[application.name] = `${Date.now() - start}ms`;

    // ? Configuration values provided bootstrap take priority over module level
    if (!is.empty(options?.configuration)) {
      ZCC.config.merge(options?.configuration);
    }

    // - Kick off lifecycle
    logger.debug(`[PreInit] running lifecycle callbacks`);
    STATS.PreInit = await RunStageCallbacks("PreInit");
    // - Pull in user configurations
    logger.debug("loading configuration");
    STATS.Configure = await CfgManager()[INITIALIZE](application);
    // - Run through other events in order
    logger.debug(`[PostConfig] running lifecycle callbacks`);
    STATS.PostConfig = await RunStageCallbacks("PostConfig");
    logger.debug(`[Bootstrap] running lifecycle callbacks`);
    STATS.Bootstrap = await RunStageCallbacks("Bootstrap");
    logger.debug(`[Ready] running lifecycle callbacks`);
    STATS.Ready = await RunStageCallbacks("Ready");

    STATS.Total = `${Date.now() - startup.getTime()}ms`;
    // * App is ready!
    logger.info(
      options?.showExtraBootStats ? STATS : { Total: STATS.Total },
      `🪄 [%s] application bootstrapped`,
      application.name,
    );
    ACTIVE_APPLICATION = application;
  } catch (error) {
    logger?.fatal({ error }, "bootstrap failed");
    exit();
  }
}

// ## Teardown
async function Teardown() {
  if (!ACTIVE_APPLICATION) {
    return;
  }
  logger.info(`tearing down application`);
  logger.debug(`[ShutdownStart] running lifecycle callbacks`);
  await RunStageCallbacks("ShutdownStart");
  logger.debug(`[ShutdownComplete] running lifecycle callbacks`);
  await RunStageCallbacks("ShutdownComplete");
  ACTIVE_APPLICATION = undefined;
  completedLifecycleCallbacks = new Set<string>();
  processEvents.forEach((callback, event) =>
    process.removeListener(event, callback),
  );
  logger.info(
    { started_at: ZCC.utils.relativeDate(startup) },
    `application terminated`,
  );
}

// # Lifecycle
function CreateChildLifecycle(name?: string): TLoadableChildLifecycle {
  const stages = [...LIFECYCLE_STAGES];
  const childCallbacks = Object.fromEntries(
    stages.map((i) => [i, []]),
  ) as Record<LifecycleStages, CallbackList>;

  const [
    onPreInit,
    onPostConfig,
    onBootstrap,
    onReady,
    onShutdownStart,
    onShutdownComplete,
  ] = LIFECYCLE_STAGES.map(
    (stage) =>
      (callback: LifecycleCallback, priority = NONE) => {
        if (completedLifecycleCallbacks.has(`on${stage}`)) {
          // this is makes "earliest run time" logic way easier to implement
          // intended mode of operation
          if (["PreInit", "PostConfig", "Bootstrap", "Ready"].includes(stage)) {
            setImmediate(async () => await callback());
            return;
          }
          // What does this mean in reality?
          // Probably a broken unit test, I really don't know what workflow would cause this
          logger.fatal(`on${stage} late attach, cannot attach callback`);
          return;
        }
        childCallbacks[stage].push([callback, priority]);
      },
  );

  const lifecycle = {
    getCallbacks: (stage: LifecycleStages) =>
      childCallbacks[stage] as CallbackList,
    onBootstrap,
    onPostConfig,
    onPreInit,
    onReady,
    onShutdownComplete,
    onShutdownStart,
  };
  if (!is.empty(name)) {
    LOADED_LIFECYCLES.set(name, lifecycle);
  }
  return lifecycle;
}

// # Global Attachments

// ## Safe Exec
ZCC.safeExec = async <LABELS extends BaseLabels>(
  options: (() => TBlackHole) | SafeExecOptions<LABELS>,
) => {
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
    ZCC.systemLogger.error({ error, ...labels }, `Callback threw error`);
    if (!is.empty(labels.label)) {
      errorMetric?.inc(labels as LabelFixer<LABELS>);
    }
  }
};

// ## Testing
// DATesting.FailFast = (): void => exit();
// DATesting.LOADED_MODULES = () => LOADED_MODULES;
// DATesting.MODULE_MAPPINGS = () => MODULE_MAPPINGS;
// DATesting.REVERSE_MODULE_MAPPING = () => REVERSE_MODULE_MAPPING;
// DATesting.WiringReset = () => {
//   process.removeAllListeners();
//   MODULE_MAPPINGS = new Map();
//   LOADED_MODULES = new Map();
//   LOADED_LIFECYCLES = new Map();
//   REVERSE_MODULE_MAPPING = new Map();
//   completedLifecycleCallbacks = new Set<string>();
//   ACTIVE_APPLICATION = undefined;
// };
// DATesting.WireService = WireService;

// # Type declarations
declare module "." {
  // ## DATesting
  // export interface DATestingUtils {
  //   // void for unit testing, never for reality
  //   FailFast: () => void;
  //   Teardown: typeof Teardown;
  //   /**
  //    * exported helpers for unit testing, no use to applications
  //    */
  //   LOADED_MODULES: () => typeof LOADED_MODULES;
  //   MODULE_MAPPINGS: () => typeof MODULE_MAPPINGS;
  //   REVERSE_MODULE_MAPPING: () => typeof REVERSE_MODULE_MAPPING;
  //   WiringReset: () => void;
  //   WireService: typeof WireService;
  // }

  export interface InternalDefinition {
    /**
     * In case something needs to grab details about the app
     *
     * Abnormal operation
     */
    application: ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>;
    bootOptions: BootstrapOptions;
    safeExec: <LABELS extends BaseLabels>(
      options: (() => TBlackHole) | SafeExecOptions<LABELS>,
    ) => Promise<void>;
  }
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
// Type definitions for global ZCC attachments

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
