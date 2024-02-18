import { each, eachSeries } from "async";
import { EventEmitter } from "events";
import { Level } from "pino";
import { exit } from "process";
import { Counter, Summary } from "prom-client";

import { DOWN, is, TBlackHole, TContext, UP, ZCC, ZCC_Testing } from "../..";
import {
  ApplicationConfigurationOptions,
  BootstrapException,
  BootstrapOptions,
  CallbackList,
  ConfigurationFiles,
  GetApisResult,
  LibraryConfigurationOptions,
  LIFECYCLE_STAGES,
  LifecycleCallback,
  LifecycleStages,
  LoadedModules,
  OptionalModuleConfiguration,
  ServiceFunction,
  ServiceMap,
  StringConfig,
  TLifecycleBase,
  TLoadableChildLifecycle,
  TModuleMappings,
  TResolvedModuleMappings,
  TScheduler,
  TServiceParams,
  TServiceReturn,
  WIRE_PROJECT,
  ZCC_APPLICATION_ERROR,
  ZCC_LIBRARY_ERROR,
  ZCCApplicationDefinition,
  ZCCLibraryDefinition,
} from "../helpers";
import { CacheProviders, ZCC_Cache } from "./cache.extension";
import {
  ConfigManager,
  INITIALIZE,
  INJECTED_DEFINITIONS,
  LOAD_PROJECT,
  ZCC_Configuration,
} from "./configuration.extension";
import { ZCC_Fetch } from "./fetch.extension";
import { ILogger, ZCC_Logger } from "./logger.extension";
import { ZCC_Scheduler } from "./scheduler.extension";

// @doc obsidian://open?vault=obsidian&file=01%20Libraries%2F01.04%20Boilerplate%2FExtensions%2FWiring

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
let MODULE_MAPPINGS = new Map<string, TModuleMappings>();

/**
 * association of projects to { service : Initialized Service }
 */
let LOADED_MODULES = new Map<string, TResolvedModuleMappings>();

/**
 * Optimized reverse lookups: Declaration  Function => [project, service]
 */
let REVERSE_MODULE_MAPPING = new Map<
  ServiceFunction,
  [project: string, service: string]
>();

let LOADED_LIFECYCLES = new Map<string, TLoadableChildLifecycle>();

/**
 * Details relating to the application that is actively running
 */
let ACTIVE_APPLICATION: ZCCApplicationDefinition<
  ServiceMap,
  OptionalModuleConfiguration
> = undefined;

// heisenberg's variables. it's probably here, but maybe not
let scheduler: TScheduler;
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
      await ZCC_Testing.FailFast();
    },
  ],
  [
    "SIGINT",
    async () => {
      logger.warn(`received [SIGINT]`);
      await Teardown();
      await ZCC_Testing.FailFast();
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
      } as StringConfig<Level>,
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
      cache: ZCC_Cache,
      configuration: ZCC_Configuration,
      fetch: ZCC_Fetch,
      logger: ZCC_Logger,
      scheduler: ZCC_Scheduler,
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
  return [...out, ...list.filter(i => !out.includes(i))];
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
}: LibraryConfigurationOptions<S, C>): ZCCLibraryDefinition<S, C> {
  ValidateLibrary(libraryName, services);

  const lifecycle = CreateChildLifecycle();

  const generated = {} as GetApisResult<ServiceMap>;

  const library = {
    [WIRE_PROJECT]: async () => {
      // This one hasn't been loaded yet, generate an object with all the correct properties
      LOADED_LIFECYCLES.set(libraryName, lifecycle);
      // not defined for boilerplate (chicken & egg)
      // manually added inside the bootstrap process
      CfgManager()?.[LOAD_PROJECT](
        libraryName as keyof LoadedModules,
        configuration,
      );
      await eachSeries(
        WireOrder(priorityInit, Object.keys(services)),
        async service => {
          generated[service] = await WireService(
            libraryName,
            service,
            services[service],
            lifecycle,
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
    onError: callback => ZCC.event.on(ZCC_LIBRARY_ERROR(libraryName), callback),
    priorityInit,
    services,
  } as ZCCLibraryDefinition<S, C>;
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
    [WIRE_PROJECT]: async () => {
      LOADED_LIFECYCLES.set(name, lifecycle);
      CfgManager()[LOAD_PROJECT](name as keyof LoadedModules, configuration);
      await eachSeries(
        WireOrder(priorityInit, Object.keys(services)),
        async service => {
          await WireService(name, service, services[service], lifecycle);
        },
      );
      return lifecycle;
    },
    booted: false,
    bootstrap: async options => {
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
    onError: callback => ZCC.event.on(ZCC_APPLICATION_ERROR, callback),
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
  } as ZCCApplicationDefinition<S, C>;
  return application;
}

// # Wiring
// ## Wire Service
async function WireService(
  project: string,
  service: string,
  definition: ServiceFunction,
  lifecycle: TLifecycleBase,
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
      [...LOADED_MODULES.keys()].map(project => [
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
      lifecycle,
      logger,
      scheduler,
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
    // eslint-disable-next-line no-console
    console.log(error);
    ZCC_Testing.FailFast();
    return undefined;
  }
}

// ## Run Callbacks
async function RunStageCallbacks(stage: LifecycleStages) {
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
  await eachSeries(list, async callbacks => {
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
}

let startup: Date;

// # Lifecycle runners
// ## Bootstrap
async function Bootstrap<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>(application: ZCCApplicationDefinition<S, C>, options: BootstrapOptions) {
  if (ACTIVE_APPLICATION) {
    throw new BootstrapException(
      COERCE_CONTEXT("wiring.extension"),
      "NO_DUAL_BOOT",
      "Another application is already active, please terminate",
    );
  }
  startup = new Date();
  try {
    // * Recreate base eventemitter
    ZCC.event = new EventEmitter();
    // ? Some libraries need to be aware of
    ZCC.application = application;

    // * Generate a new boilerplate module
    LIB_BOILERPLATE = CreateBoilerplate();

    // * Wire it
    await LIB_BOILERPLATE[WIRE_PROJECT]();
    // ~ configuration
    CfgManager()[LOAD_PROJECT](
      LIB_BOILERPLATE.name,
      LIB_BOILERPLATE.configuration,
    );
    // ~ scheduler (for injecting into other modules)
    scheduler = LOADED_MODULES.get(LIB_BOILERPLATE.name)
      .scheduler as TScheduler;
    logger = ZCC.logger.context(WIRING_CONTEXT);
    logger.info(`[boilerplate] wiring complete`);

    // * Wire in various shutdown events
    processEvents.forEach((callback, event) => {
      process.on(event, callback);
      logger.trace({ event }, "shutdown event");
    });

    // * Add in libraries
    application.libraries ??= [];
    await eachSeries(application.libraries, async i => {
      logger.info(`[%s] init project`, i.name);
      await i[WIRE_PROJECT]();
    });

    logger.info(`init application`);
    // * Finally the application
    await application[WIRE_PROJECT]();

    // ? Configuration values provided bootstrap take priority over module level
    if (!is.empty(options?.configuration)) {
      ZCC.config.merge(options?.configuration);
    }

    // - Kick off lifecycle
    logger.debug(`[PreInit] running lifecycle callbacks`);
    await RunStageCallbacks("PreInit");
    // - Pull in user configurations
    logger.debug("loading configuration");
    await CfgManager()[INITIALIZE](application);
    // - Run through other events in order
    logger.debug(`[PostConfig] running lifecycle callbacks`);
    await RunStageCallbacks("PostConfig");
    logger.debug(`[Bootstrap] running lifecycle callbacks`);
    await RunStageCallbacks("Bootstrap");
    logger.debug(`[Ready] running lifecycle callbacks`);
    await RunStageCallbacks("Ready");

    // * App is ready!
    logger.info(`🪄 [%s] application bootstrapped`, application.name);
    ACTIVE_APPLICATION = application;
  } catch (error) {
    logger?.fatal({ application, error }, "bootstrap failed");
    ZCC_Testing.FailFast();
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
  const childCallbacks = Object.fromEntries(stages.map(i => [i, []])) as Record<
    LifecycleStages,
    CallbackList
  >;

  const [
    onPreInit,
    onPostConfig,
    onBootstrap,
    onReady,
    onShutdownStart,
    onShutdownComplete,
  ] = LIFECYCLE_STAGES.map(
    stage =>
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
ZCC_Testing.configurationFiles = ConfigurationFiles;
ZCC_Testing.FailFast = (): void => exit();
ZCC_Testing.LOADED_MODULES = () => LOADED_MODULES;
ZCC_Testing.MODULE_MAPPINGS = () => MODULE_MAPPINGS;
ZCC_Testing.REVERSE_MODULE_MAPPING = () => REVERSE_MODULE_MAPPING;
ZCC_Testing.WiringReset = () => {
  process.removeAllListeners();
  MODULE_MAPPINGS = new Map();
  LOADED_MODULES = new Map();
  LOADED_LIFECYCLES = new Map();
  REVERSE_MODULE_MAPPING = new Map();
  completedLifecycleCallbacks = new Set<string>();
  ACTIVE_APPLICATION = undefined;
};
ZCC_Testing.WireService = WireService;

// # Type declarations
declare module "../../utilities" {
  // ## ZCC_Testing
  export interface ZCCTestingDefinition {
    // void for unit testing, never for reality
    FailFast: () => void;
    Teardown: typeof Teardown;
    /**
     * exported helpers for unit testing, no use to applications
     */
    LOADED_MODULES: () => typeof LOADED_MODULES;
    MODULE_MAPPINGS: () => typeof MODULE_MAPPINGS;
    REVERSE_MODULE_MAPPING: () => typeof REVERSE_MODULE_MAPPING;
    WiringReset: () => void;
    WireService: typeof WireService;
  }
  // ## ZCC
  export interface ZCCDefinition {
    /**
     * In case something needs to grab details about the app
     *
     * Abnormal operation
     */
    application: ZCCApplicationDefinition<
      ServiceMap,
      OptionalModuleConfiguration
    >;
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
