import { EventEmitter } from "events";
import { exit } from "process";

import {
  ApplicationConfigurationOptions,
  ApplicationDefinition,
  BootstrapException,
  BootstrapOptions,
  BuildSortOrder,
  CacheProviders,
  COERCE_CONTEXT,
  CreateLibrary,
  DOWN,
  each,
  eachSeries,
  GetApis,
  GetApisResult,
  LifecyclePrioritizedCallback,
  LifecycleStages,
  LoadedModules,
  OptionalModuleConfiguration,
  ServiceFunction,
  ServiceMap,
  StringConfig,
  TLifecycleBase,
  TServiceParams,
  TServiceReturn,
  UP,
  WIRE_PROJECT,
  WireOrder,
  WIRING_CONTEXT,
} from "../helpers";
import { InternalDefinition, is } from ".";
import { Cache } from "./cache.extension";
import {
  Configuration,
  INITIALIZE,
  INJECTED_DEFINITIONS,
  LOAD_PROJECT,
} from "./configuration.extension";
import { Fetch } from "./fetch.extension";
import { CreateChildLifecycle } from "./lifecycle.extension";
import { ILogger, Logger, TConfigLogLevel } from "./logger.extension";
import { Scheduler } from "./scheduler.extension";

// #MARK: CreateBoilerplate
function CreateBoilerplate() {
  // ! DO NOT MOVE TO ANOTHER FILE !
  // While it SEEMS LIKE this can be safely moved, it causes code init race conditions.
  return CreateLibrary({
    configuration: {
      CACHE_PREFIX: {
        default: "",
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
      } as StringConfig<TConfigLogLevel>,
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
const PRE_CALLBACKS_START = 0;

// (re)defined at bootstrap
// unclear if this variable even serves a purpose beyond types
export let LIB_BOILERPLATE: ReturnType<typeof CreateBoilerplate>;

const RUNNING_APPLICATIONS = new Map<
  string,
  ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>
>();

// #MARK: QuickShutdown
async function QuickShutdown(reason: string) {
  await each([...RUNNING_APPLICATIONS.values()], async (application) => {
    application.logger.warn({ reason }, `starting shutdown`);
    await application.teardown();
  });
}

// #MARK: processEvents
const processEvents = new Map([
  [
    "SIGTERM",
    async () => {
      await QuickShutdown("SIGTERM");
      exit();
    },
  ],
  [
    "SIGINT",
    async () => {
      await QuickShutdown("SIGINT");
      exit();
    },
  ],
  // ["uncaughtException", () => {}],
  // ["unhandledRejection", (reason, promise) => {}],
]);

const BOILERPLATE = (internal: InternalDefinition) =>
  internal.boot.loadedModules.get("boilerplate") as GetApis<
    ReturnType<typeof CreateBoilerplate>
  >;

// #MARK: CreateApplication
export function CreateApplication<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>({
  name,
  services = {} as S,
  configurationLoaders,
  libraries = [],
  configuration = {} as C,
  priorityInit = [],
}: ApplicationConfigurationOptions<S, C>) {
  let internal: InternalDefinition;

  priorityInit.forEach((name) => {
    if (!is.function(services[name])) {
      throw new BootstrapException(
        WIRING_CONTEXT,
        "MISSING_PRIORITY_SERVICE",
        `${name} was listed as priority init, but was not found in services`,
      );
    }
  });
  const serviceApis = {} as GetApisResult<ServiceMap>;
  const application = {
    [WIRE_PROJECT]: async (internal: InternalDefinition) => {
      const lifecycle = CreateChildLifecycle(internal, application.logger);
      internal.boot.lifecycleHooks.set(name, lifecycle);
      BOILERPLATE(internal)?.configuration?.[LOAD_PROJECT](
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
      if (internal) {
        throw new BootstrapException(
          WIRING_CONTEXT,
          "NO_DUAL_BOOT",
          "Another application is already active, please terminate",
        );
      }
      internal = new InternalDefinition();
      await Bootstrap(application, options, internal);
      application.booted = true;
      RUNNING_APPLICATIONS.set(name, application);
    },
    configuration,
    configurationLoaders,
    libraries,
    logger: undefined,
    name,
    priorityInit,
    serviceApis,
    services,
    teardown: async () => {
      if (!application.booted) {
        processEvents.forEach((callback, event) =>
          process.removeListener(event, callback),
        );
        return;
      }
      await Teardown(internal, application.logger);
      internal?.utils?.event?.removeAllListeners?.();
      application.booted = false;
      internal = undefined;
    },
  } as ApplicationDefinition<S, C>;
  return application;
}

// #MARK: WireService
async function WireService(
  project: string,
  service: string,
  definition: ServiceFunction,
  lifecycle: TLifecycleBase,
  internal: InternalDefinition,
) {
  const mappings = internal.boot.moduleMappings.get(project) ?? {};
  if (!is.undefined(mappings[service])) {
    throw new BootstrapException(
      WIRING_CONTEXT,
      "DUPLICATE_SERVICE_NAME",
      `${service} is already defined for ${project}`,
    );
  }
  mappings[service] = definition;
  internal.boot.moduleMappings.set(project, mappings);
  const context = COERCE_CONTEXT(`${project}:${service}`);

  // logger gets defined first, so this really is only for the start of the start of bootstrapping
  const boilerplate = BOILERPLATE(internal);
  const logger = boilerplate?.logger?.context(context);
  const loaded = internal.boot.loadedModules.get(project) ?? {};
  internal.boot.loadedModules.set(project, loaded);
  try {
    logger?.trace({ name: WireService }, `initializing`);
    const inject = Object.fromEntries(
      [...internal.boot.loadedModules.keys()].map((project) => [
        project as keyof TServiceParams,
        internal.boot.loadedModules.get(project),
      ]),
    );

    loaded[service] = (await definition({
      ...inject,
      cache: boilerplate?.cache,
      config: boilerplate?.configuration?.[INJECTED_DEFINITIONS](),
      context,
      event: internal?.utils?.event,
      internal,
      lifecycle,
      logger,
      scheduler: boilerplate?.scheduler?.(context),
    })) as TServiceReturn;

    return loaded[service];
  } catch (error) {
    // Init errors at this level are considered blocking / fatal
    // eslint-disable-next-line no-console
    console.error("initialization error", error);
    exit();
  }
}

// #MARK: RunStageCallbacks
async function RunStageCallbacks(
  stage: LifecycleStages,
  internal: InternalDefinition,
): Promise<string> {
  const start = Date.now();
  const list = [
    // boilerplate priority
    internal.boot.lifecycleHooks.get("boilerplate").getCallbacks(stage),
    // children next
    // ...
    ...[...internal.boot.lifecycleHooks.entries()]
      .filter(([name]) => name !== "boilerplate")
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
      positive.sort(([, a], [, b]) => (a < b ? UP : DOWN)),
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

// #MARK: Bootstrap
async function Bootstrap<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>(
  application: ApplicationDefinition<S, C>,
  options: BootstrapOptions = {},
  internal: InternalDefinition,
) {
  // const
  internal.boot = {
    application,
    completedLifecycleEvents: new Set(),
    lifecycleHooks: new Map(),
    loadedModules: new Map(),
    moduleMappings: new Map(),
    options,
    phase: "bootstrap",
    startup: new Date(),
  };
  process.title = application.name;
  try {
    const STATS = {} as Record<string, unknown>;
    const CONSTRUCT = {} as Record<string, unknown>;

    // pre-create loaded module for boilerplate, so it can be attached to `internal`
    // this allows it to be used as part of `internal` during boilerplate construction
    // otherwise it'd only be there for everyone else
    const api = {} as GetApis<ReturnType<typeof CreateBoilerplate>>;
    internal.boilerplate = api;
    internal.boot.loadedModules.set("boilerplate", api);

    STATS.Construct = CONSTRUCT;
    // * Recreate base eventemitter
    internal.utils.event = new EventEmitter();
    // ? Some libraries need to be aware of

    // * Generate a new boilerplate module
    LIB_BOILERPLATE = CreateBoilerplate();

    // * Wire it
    let start = Date.now();
    await LIB_BOILERPLATE[WIRE_PROJECT](internal, WireService, undefined);

    CONSTRUCT.boilerplate = `${Date.now() - start}ms`;
    // ~ configuration
    api.configuration?.[LOAD_PROJECT](
      LIB_BOILERPLATE.name,
      LIB_BOILERPLATE.configuration,
    );
    const logger = api.logger.context(WIRING_CONTEXT);
    application.logger = logger;
    logger.info({ name: Bootstrap }, `[boilerplate] wiring complete`);

    // * Wire in various shutdown events
    processEvents.forEach((callback, event) => {
      process.on(event, callback);
      logger.trace({ event, name: Bootstrap }, "shutdown event");
    });

    // * Add in libraries
    application.libraries ??= [];
    const order = BuildSortOrder(application, logger);
    await eachSeries(order, async (i) => {
      start = Date.now();
      logger.info({ name: Bootstrap }, `[%s] init project`, i.name);
      await i[WIRE_PROJECT](internal, WireService, logger);
      CONSTRUCT[i.name] = `${Date.now() - start}ms`;
    });

    logger.info({ name: Bootstrap }, `init application`);
    // * Finally the application
    start = Date.now();
    await application[WIRE_PROJECT](internal, WireService, logger);
    CONSTRUCT[application.name] = `${Date.now() - start}ms`;

    // ? Configuration values provided bootstrap take priority over module level
    if (!is.empty(options?.configuration)) {
      api.configuration.merge(options?.configuration);
    }

    // - Kick off lifecycle
    logger.debug({ name: Bootstrap }, `[PreInit] running lifecycle callbacks`);
    STATS.PreInit = await RunStageCallbacks("PreInit", internal);
    // - Pull in user configurations
    logger.debug({ name: Bootstrap }, "loading configuration");
    STATS.Configure =
      await BOILERPLATE(internal)?.configuration?.[INITIALIZE](application);
    // - Run through other events in order
    logger.debug(
      { name: Bootstrap },
      `[PostConfig] running lifecycle callbacks`,
    );
    STATS.PostConfig = await RunStageCallbacks("PostConfig", internal);
    logger.debug(
      { name: Bootstrap },
      `[Bootstrap] running lifecycle callbacks`,
    );
    STATS.Bootstrap = await RunStageCallbacks("Bootstrap", internal);
    logger.debug({ name: Bootstrap }, `[Ready] running lifecycle callbacks`);
    STATS.Ready = await RunStageCallbacks("Ready", internal);

    STATS.Total = `${Date.now() - internal.boot.startup.getTime()}ms`;
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
    if (options?.configuration?.boilerplate?.LOG_LEVEL !== "silent") {
      // eslint-disable-next-line no-console
      console.error("bootstrap failed", error);
    }
    exit();
  }
}

// #MARK: Teardown
async function Teardown(internal: InternalDefinition, logger: ILogger) {
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
    await RunStageCallbacks("PreShutdown", internal);

    // * Formally shutting down
    logger.info({ name: Teardown }, `tearing down application`);
    logger.debug(
      { name: Teardown },
      `[ShutdownStart] running lifecycle callbacks`,
    );
    await RunStageCallbacks("ShutdownStart", internal);
    logger.debug(
      { name: Teardown },
      `[ShutdownComplete] running lifecycle callbacks`,
    );
    await RunStageCallbacks("ShutdownComplete", internal);
  } catch (error) {
    // ! oof
    logger.error(
      { error, name: Teardown },
      "error occurred during teardown, some lifecycle events may be incomplete",
    );
  }
  // * Final resource cleanup, attempt to reset everything possible

  logger.info(
    {
      name: Teardown,
      started_at: internal.utils.relativeDate(internal.boot.startup),
    },
    `application terminated`,
  );
  processEvents.forEach((callback, event) =>
    process.removeListener(event, callback),
  );
}
