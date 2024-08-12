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
  each,
  eachSeries,
  GetApis,
  GetApisResult,
  LoadedModules,
  OptionalModuleConfiguration,
  ServiceFunction,
  ServiceMap,
  SINGLE,
  StringConfig,
  TLifecycleBase,
  TServiceParams,
  TServiceReturn,
  WIRE_PROJECT,
  WireOrder,
  WIRING_CONTEXT,
} from "../helpers";
import { InternalDefinition, is, Metrics } from ".";
import { Cache } from "./cache.extension";
import {
  Configuration,
  INITIALIZE,
  INJECTED_DEFINITIONS,
  LOAD_PROJECT,
} from "./configuration.extension";
import { Fetch } from "./fetch.extension";
import { CreateLifecycle } from "./lifecycle.extension";
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
      } satisfies StringConfig<`${CacheProviders}`>,
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
      } satisfies StringConfig<TConfigLogLevel>,
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
    priorityInit: ["metrics", "configuration", "logger"],
    services: {
      cache: Cache,
      configuration: Configuration,
      fetch: Fetch,
      logger: Logger,
      metrics: Metrics,
      scheduler: Scheduler,
    },
  });
}

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
            internal.boot.lifecycle.events,
            internal,
          );
        },
      );
      const append = internal.boot.options?.appendService;
      if (!is.empty(append)) {
        await eachSeries(Object.keys(append), async (service) => {
          await WireService(
            name,
            service,
            append[service],
            internal.boot.lifecycle.events,
            internal,
          );
        });
      }
      internal.boot.constructComplete.add(name);
    },
    booted: false,
    bootstrap: async (options: BootstrapOptions) => {
      if (application.booted) {
        throw new BootstrapException(
          WIRING_CONTEXT,
          "DOUBLE_BOOT",
          "Application is already booted! Cannot bootstrap again",
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
  } as unknown as ApplicationDefinition<S, C>;
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
    (logger || console).error("initialization error", error);
    exit();
  }
}

const runPreInit = async (internal: InternalDefinition) => {
  const duration = await internal.boot.lifecycle.exec("PreInit");
  internal.boot.completedLifecycleEvents.add("PreInit");
  return duration;
};

const runPostConfig = async (internal: InternalDefinition) => {
  const duration = await internal.boot.lifecycle.exec("PostConfig");
  internal.boot.completedLifecycleEvents.add("PostConfig");
  return duration;
};

const runBootstrap = async (internal: InternalDefinition) => {
  const duration = await internal.boot.lifecycle.exec("Bootstrap");
  internal.boot.completedLifecycleEvents.add("Bootstrap");
  return duration;
};

const runReady = async (internal: InternalDefinition) => {
  const duration = await internal.boot.lifecycle.exec("Ready");
  internal.boot.completedLifecycleEvents.add("Ready");
  return duration;
};

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
    constructComplete: new Set(),
    lifecycle: CreateLifecycle(),
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
    await LIB_BOILERPLATE[WIRE_PROJECT](internal, WireService);

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

    if (!is.undefined(options.appendLibrary)) {
      const list = is.array(options.appendLibrary)
        ? options.appendLibrary
        : [options.appendLibrary];
      list.forEach((append) => {
        application.libraries.some((library, index) => {
          if (append.name === library.name) {
            // remove existing
            logger.warn({ name: append.name }, `replacing library`);
            application.libraries.splice(index, SINGLE);
            return true;
          }
          return false;
        });
        logger.info({ name: append.name }, `appending library`);
        // append
        application.libraries.push(append);
      });
    }

    const order = BuildSortOrder(application, logger);
    await eachSeries(order, async (i) => {
      start = Date.now();
      logger.info({ name: Bootstrap }, `[%s] init project`, i.name);
      await i[WIRE_PROJECT](internal, WireService);
      CONSTRUCT[i.name] = `${Date.now() - start}ms`;
    });

    // * Finally the application
    if (options.bootLibrariesFirst) {
      logger.warn({ name: Bootstrap }, `bootLibrariesFirst`);
    } else {
      logger.info({ name: Bootstrap }, `init application`);
      start = Date.now();
      await application[WIRE_PROJECT](internal, WireService);
      CONSTRUCT[application.name] = `${Date.now() - start}ms`;
    }

    // ? Configuration values provided bootstrap take priority over module level
    if (!is.empty(options?.configuration)) {
      api.configuration.merge(options?.configuration);
    }

    // - Kick off lifecycle
    logger.debug({ name: Bootstrap }, `[PreInit] running lifecycle callbacks`);
    STATS.PreInit = await runPreInit(internal);
    // - Pull in user configurations
    logger.debug({ name: Bootstrap }, "loading configuration");
    STATS.Configure =
      await BOILERPLATE(internal)?.configuration?.[INITIALIZE](application);
    // - Run through other events in order
    logger.debug(
      { name: Bootstrap },
      `[PostConfig] running lifecycle callbacks`,
    );

    STATS.PostConfig = await runPostConfig(internal);
    logger.debug(
      { name: Bootstrap },
      `[Bootstrap] running lifecycle callbacks`,
    );
    STATS.Bootstrap = await runBootstrap(internal);

    if (options.bootLibrariesFirst) {
      // * mental note
      // running between bootstrap & ready seems most appropriate
      // resources are expected to *technically* be ready at this point, but not finalized
      // reference examples:
      // - hass: socket is open & resources are ready
      // - fastify: bindings are available but port isn't listening

      logger.info({ name: Bootstrap }, `late init application`);
      start = Date.now();
      await application[WIRE_PROJECT](internal, WireService);
      CONSTRUCT[application.name] = `${Date.now() - start}ms`;
    }

    logger.debug({ name: Bootstrap }, `[Ready] running lifecycle callbacks`);
    STATS.Ready = await runReady(internal);

    STATS.Total = `${Date.now() - internal.boot.startup.getTime()}ms`;
    // * App is ready!
    logger.info(
      options?.showExtraBootStats
        ? { ...STATS, name: Bootstrap }
        : { Total: STATS.Total, name: Bootstrap },
      `[%s] application bootstrapped`,
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
    await internal.boot.lifecycle.exec("PreShutdown");
    internal.boot.completedLifecycleEvents.add("PreShutdown");

    // * Formally shutting down
    logger.info({ name: Teardown }, `tearing down application`);
    logger.debug(
      { name: Teardown },
      `[ShutdownStart] running lifecycle callbacks`,
    );
    await internal.boot.lifecycle.exec("ShutdownStart");
    internal.boot.completedLifecycleEvents.add("ShutdownStart");
    logger.debug(
      { name: Teardown },
      `[ShutdownComplete] running lifecycle callbacks`,
    );
    await internal.boot.lifecycle.exec("ShutdownComplete");
    internal.boot.completedLifecycleEvents.add("ShutdownComplete");
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
