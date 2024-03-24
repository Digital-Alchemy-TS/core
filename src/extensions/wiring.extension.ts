import { EventEmitter } from "events";
import { exit } from "process";

import {
  ApplicationConfigurationOptions,
  ApplicationDefinition,
  BootstrapException,
  BootstrapOptions,
  CacheProviders,
  CallbackList,
  DOWN,
  each,
  eachSeries,
  GetApis,
  GetApisResult,
  LibraryConfigurationOptions,
  LibraryDefinition,
  LIFECYCLE_STAGES,
  LifecycleCallback,
  LifecyclePrioritizedCallback,
  LifecycleStages,
  LoadedModules,
  OptionalModuleConfiguration,
  ServiceFunction,
  ServiceMap,
  StringConfig,
  TContext,
  TLifecycleBase,
  TLoadableChildLifecycle,
  TModuleMappings,
  TResolvedModuleMappings,
  TServiceParams,
  TServiceReturn,
  UP,
  WIRE_PROJECT,
} from "../helpers";
import { InternalDefinition, is } from ".";
import { Cache } from "./cache.extension";
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
export let REVERSE_MODULE_MAPPING = new Map<
  ServiceFunction,
  [project: string, service: string]
>();

let LOADED_LIFECYCLES = new Map<string, TLoadableChildLifecycle>();

// heisenberg's variables. it's probably here, but maybe not
// let scheduler: (context: TContext) => TScheduler;
let logger: ILogger;
let internal: InternalDefinition;
const COERCE_CONTEXT = (context: string): TContext => context as TContext;
const WIRING_CONTEXT = COERCE_CONTEXT("boilerplate:wiring");
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
      logger.warn({ name: "SIGTERM" }, `starting`);
      await Teardown();
      exit();
    },
  ],
  [
    "SIGINT",
    async () => {
      logger.warn({ name: "SIGINT" }, `starting`);
      await Teardown();
      exit();
    },
  ],
  // ### Major application errors
  // ["uncaughtException", () => {}],
  // ["unhandledRejection", (reason, promise) => {}],
]);

// ## Boilerplate Quick Ref
const BOILERPLATE = () =>
  LOADED_MODULES.get("boilerplate") as GetApis<
    ReturnType<typeof CreateBoilerplate>
  >;

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

  const serviceApis = {} as GetApisResult<ServiceMap>;

  const library = {
    [WIRE_PROJECT]: async (internal: InternalDefinition) => {
      // This one hasn't been loaded yet, generate an object with all the correct properties
      LOADED_LIFECYCLES.set(libraryName, lifecycle);
      // not defined for boilerplate (chicken & egg)
      // manually added inside the bootstrap process
      const config = internal?.boilerplate.configuration as ConfigManager;
      config?.[LOAD_PROJECT](libraryName as keyof LoadedModules, configuration);
      await eachSeries(
        WireOrder(priorityInit, Object.keys(services)),
        async (service) => {
          serviceApis[service] = await WireService(
            libraryName,
            service,
            services[service],
            lifecycle,
            internal,
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
    priorityInit,
    serviceApis,
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
  const serviceApis = {} as GetApisResult<ServiceMap>;
  const application = {
    [WIRE_PROJECT]: async (internal: InternalDefinition) => {
      LOADED_LIFECYCLES.set(name, lifecycle);
      BOILERPLATE()?.configuration?.[LOAD_PROJECT](
        name as keyof LoadedModules,
        configuration,
      );
      await eachSeries(
        WireOrder(priorityInit, Object.keys(services)),
        async (service) => {
          serviceApis[service] = await WireService(
            name,
            service,
            services[service],
            lifecycle,
            internal,
          );
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
    priorityInit,
    serviceApis,
    services,
    teardown: async () => {
      if (!application.booted) {
        logger.error(
          { name: CreateApplication },
          `application is not booted, cannot teardown`,
        );
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
  internal: InternalDefinition,
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
  const boilerplate = BOILERPLATE();
  const logger = boilerplate?.logger?.context(context);
  const loaded = LOADED_MODULES.get(project) ?? {};
  LOADED_MODULES.set(project, loaded);
  try {
    logger?.trace({ name: WireService }, `initializing`);
    const inject = Object.fromEntries(
      [...LOADED_MODULES.keys()].map((project) => [
        project as keyof TServiceParams,
        LOADED_MODULES.get(project),
      ]),
    );

    loaded[service] = (await definition({
      ...inject,
      cache: boilerplate.cache,
      config: boilerplate?.configuration?.[INJECTED_DEFINITIONS](),
      context,
      event: internal.utils.event,
      internal,
      lifecycle,
      logger,
      scheduler: boilerplate?.scheduler?.(context),
    })) as TServiceReturn;

    return loaded[service];
  } catch (error) {
    // Init errors at this level are considered blocking / fatal
    logger?.fatal({ error, name: context }, `initialization error`);
    exit();
    return undefined;
  }
}

// ## Run Callbacks
async function RunStageCallbacks(stage: LifecycleStages): Promise<string> {
  const start = Date.now();
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
    const sorted = callbacks.filter(([, sort]) => sort !== undefined);
    const quick = callbacks.filter(([, sort]) => sort === undefined);
    const positive = [] as LifecyclePrioritizedCallback[];
    const negative = [] as LifecyclePrioritizedCallback[];
    sorted.forEach(([callback, priority]) => {
      if (priority >= PRE_CALLBACKS_START) {
        positive.push([callback, priority]);
        return;
      }
      negative.push([callback, priority]);
    });

    // * callbacks with a priority greater than 0
    // larger number happen first
    await eachSeries(
      positive.sort(([, a], [, b]) => (a > b ? UP : DOWN)),
      async ([callback]) => await callback(),
    );

    // * callbacks without a priority
    await each(quick, async ([callback]) => await callback());

    // * callbacks with a priority less than 0
    // smaller numbers happen last
    await eachSeries(
      negative.sort(([, a], [, b]) => (a > b ? UP : DOWN)),
      async ([callback]) => await callback(),
    );
  });
  internal.boot.completedLifecycleEvents.add(stage);
  return `${Date.now() - start}ms`;
}
const PRE_CALLBACKS_START = 0;

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
      if (is.empty(library.depends)) {
        return true;
      }
      return library.depends?.every((depend) =>
        out.some((i) => i.name === depend.name),
      );
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

let startup: Date;

// # Lifecycle runners
// ## Bootstrap
async function Bootstrap<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>(application: ApplicationDefinition<S, C>, options: BootstrapOptions) {
  if (internal) {
    throw new BootstrapException(
      COERCE_CONTEXT("wiring.extension"),
      "NO_DUAL_BOOT",
      "Another application is already active, please terminate",
    );
  }
  internal = new InternalDefinition();
  internal.boot = {
    application,
    completedLifecycleEvents: new Set(),
    options,
    phase: "bootstrap",
  };
  process.title = application.name;
  startup = new Date();
  try {
    const STATS = {} as Record<string, unknown>;
    const CONSTRUCT = {} as Record<string, unknown>;

    // pre-create loaded module for boilerplate, so it can be attached to `internal`
    // this allows it to be used as part of `internal` during boilerplate construction
    // otherwise it'd only be there for everyone else
    const api = {} as GetApis<ReturnType<typeof CreateBoilerplate>>;
    internal.boilerplate = api;
    LOADED_MODULES.set("boilerplate", api);

    STATS.Construct = CONSTRUCT;
    // * Recreate base eventemitter
    internal.utils.event = new EventEmitter();
    // ? Some libraries need to be aware of

    // * Generate a new boilerplate module
    LIB_BOILERPLATE = CreateBoilerplate();

    // * Wire it
    let start = Date.now();
    await LIB_BOILERPLATE[WIRE_PROJECT](internal);

    CONSTRUCT.boilerplate = `${Date.now() - start}ms`;
    // ~ configuration
    api.configuration?.[LOAD_PROJECT](
      LIB_BOILERPLATE.name,
      LIB_BOILERPLATE.configuration,
    );
    logger = api.logger.context(WIRING_CONTEXT);
    logger.info({ name: Bootstrap }, `[boilerplate] wiring complete`);

    // * Wire in various shutdown events
    processEvents.forEach((callback, event) => {
      process.on(event, callback);
      logger.trace({ event, name: Bootstrap }, "shutdown event");
    });

    // * Add in libraries
    application.libraries ??= [];
    const order = BuildSortOrder(application);
    await eachSeries(order, async (i) => {
      start = Date.now();
      logger.info({ name: Bootstrap }, `[%s] init project`, i.name);
      await i[WIRE_PROJECT](internal);
      CONSTRUCT[i.name] = `${Date.now() - start}ms`;
    });

    logger.info({ name: Bootstrap }, `init application`);
    // * Finally the application
    start = Date.now();
    await application[WIRE_PROJECT](internal);
    CONSTRUCT[application.name] = `${Date.now() - start}ms`;

    // ? Configuration values provided bootstrap take priority over module level
    if (!is.empty(options?.configuration)) {
      api.configuration.merge(options?.configuration);
    }

    // - Kick off lifecycle
    logger.debug({ name: Bootstrap }, `[PreInit] running lifecycle callbacks`);
    STATS.PreInit = await RunStageCallbacks("PreInit");
    // - Pull in user configurations
    logger.debug({ name: Bootstrap }, "loading configuration");
    STATS.Configure =
      await BOILERPLATE()?.configuration?.[INITIALIZE](application);
    // - Run through other events in order
    logger.debug(
      { name: Bootstrap },
      `[PostConfig] running lifecycle callbacks`,
    );
    STATS.PostConfig = await RunStageCallbacks("PostConfig");
    logger.debug(
      { name: Bootstrap },
      `[Bootstrap] running lifecycle callbacks`,
    );
    STATS.Bootstrap = await RunStageCallbacks("Bootstrap");
    logger.debug({ name: Bootstrap }, `[Ready] running lifecycle callbacks`);
    STATS.Ready = await RunStageCallbacks("Ready");

    STATS.Total = `${Date.now() - startup.getTime()}ms`;
    // * App is ready!
    logger.info(
      options?.showExtraBootStats
        ? { ...STATS, name: Bootstrap }
        : { Total: STATS.Total, name: Bootstrap },
      `🪄 [%s] application bootstrapped`,
      application.name,
    );
    internal.boot.phase = "running";
  } catch (error) {
    logger?.fatal({ error, name: Bootstrap }, "bootstrap failed");
    exit();
  }
}

// ## Teardown
async function Teardown() {
  if (!internal) {
    return;
  }
  // * Announce
  logger.warn({ name: Teardown }, `received teardown request`);
  internal.boot.phase = "teardown";
  try {
    // * PreShutdown
    logger.debug(
      { name: Teardown },
      `[PreShutdown] running lifecycle callbacks`,
    );
    await RunStageCallbacks("PreShutdown");

    // * Formally shutting down
    logger.info({ name: Teardown }, `tearing down application`);
    logger.debug(
      { name: Teardown },
      `[ShutdownStart] running lifecycle callbacks`,
    );
    await RunStageCallbacks("ShutdownStart");
    logger.debug(
      { name: Teardown },
      `[ShutdownComplete] running lifecycle callbacks`,
    );
    await RunStageCallbacks("ShutdownComplete");
  } catch (error) {
    // ! oof
    logger.error(
      { error, name: Teardown },
      "error occurred during teardown, some lifecycle events may be incomplete",
    );
  }
  // * Final resource cleanup, attempt to reset everything possible
  processEvents.forEach((callback, event) =>
    process.removeListener(event, callback),
  );

  logger.info(
    { name: Teardown, started_at: internal.utils.relativeDate(startup) },
    `application terminated`,
  );
  internal.utils.event.removeAllListeners();

  MODULE_MAPPINGS = new Map();
  LOADED_MODULES = new Map();
  LOADED_LIFECYCLES = new Map();
  REVERSE_MODULE_MAPPING = new Map();
  internal = undefined;
  logger = undefined;
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
    onPreShutdown,
  ] = LIFECYCLE_STAGES.map(
    (stage) => (callback: LifecycleCallback, priority?: number) => {
      if (internal.boot.completedLifecycleEvents.has(stage)) {
        // this is makes "earliest run time" logic way easier to implement
        // intended mode of operation
        if (["PreInit", "PostConfig", "Bootstrap", "Ready"].includes(stage)) {
          setImmediate(async () => await callback());
          return;
        }
        // What does this mean in reality?
        // Probably a broken unit test, I really don't know what workflow would cause this
        logger.fatal(
          { name: CreateChildLifecycle },
          `on${stage} late attach, cannot attach callback`,
        );
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
    onPreShutdown,
    onReady,
    onShutdownComplete,
    onShutdownStart,
  };
  if (!is.empty(name)) {
    LOADED_LIFECYCLES.set(name, lifecycle);
  }
  return lifecycle;
}

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
