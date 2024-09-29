import { EventEmitter } from "events";

import {
  ACTIVE_SLEEPS,
  ApplicationConfigurationOptions,
  ApplicationDefinition,
  BootstrapException,
  BootstrapOptions,
  buildSortOrder,
  COERCE_CONTEXT,
  CreateLibrary,
  each,
  eachSeries,
  GetApis,
  GetApisResult,
  ILogger,
  LoadedModules,
  NONE,
  OptionalModuleConfiguration,
  ServiceFunction,
  ServiceMap,
  SINGLE,
  StringConfig,
  TConfigLogLevel,
  TLifecycleBase,
  TServiceParams,
  TServiceReturn,
  WIRE_PROJECT,
  wireOrder,
  WIRING_CONTEXT,
} from "../helpers";
import { ALS, InternalDefinition, is } from ".";
import {
  Configuration,
  INITIALIZE,
  INJECTED_DEFINITIONS,
  LOAD_PROJECT,
} from "./configuration.extension";
import { CreateLifecycle } from "./lifecycle.extension";
import { Logger } from "./logger.extension";
import { Scheduler } from "./scheduler.extension";

export interface DeclaredEnvironments {
  prod: true;
  test: true;
  local: true;
}

// #MARK: CreateBoilerplate
function createBoilerplate() {
  // ! DO NOT MOVE TO ANOTHER FILE !
  // While it SEEMS LIKE this can be safely moved, it causes code init race conditions.
  return CreateLibrary({
    configuration: {
      ALS_ENABLED: {
        type: "string",
      },
      /**
       * Only usable by **cli switch**.
       * Pass path to a config file for loader
       *
       * ```bash
       * node dist/app.js --config ~/.config/my_app.ini
       * ```
       */
      CONFIG: {
        description: [
          "Consumable as CLI switch only",
          "If provided, all other file based configurations will be ignored",
          "Environment variables + CLI switches will operate normally",
        ].join(". "),
        type: "string",
      },
      /**
       * > by default true when:
       *
       * ```typescript
       * NODE_ENV === "test*"
       * ```
       *
       * ---
       *
       * When set
       */
      IS_TEST: {
        // test | testing
        default: process.env.NODE_ENV?.startsWith("test"),
        description: "Quick reference for if this app is currently running with test mode",
        type: "boolean",
      },
      /**
       * ### `trace`
       *
       * Very noisy, contains extra details about what's going on in the internals.
       *
       * ### `debug`
       *
       * Additional diagnostic information about operations being form. `"did a thing w/ {name}"` is common.
       *
       * ### `info`
       *
       * Notifications for high level events, and app code.
       *
       * ### `warn`
       *
       * Notification that an non-critical issue happened.
       *
       * ### `error`
       *
       * Error logs are produced from unexpected situations.
       *
       * When an external API sends back an error messages, or tools are being used in a detectably wrong way.
       *
       * ### `fatal`
       *
       * Produce a log at the highest importance level, not common
       *
       * ### `silent`
       *
       * Emit no logs at all
       */
      LOG_LEVEL: {
        default: "trace",
        description: "Minimum log level to process",
        enum: ["silent", "trace", "info", "warn", "debug", "error", "fatal"],
        type: "string",
      } satisfies StringConfig<TConfigLogLevel> as StringConfig<TConfigLogLevel>,
      /**
       * Reference to `process.env.NODE_ENV` by default, `"local"` if not provided
       */
      NODE_ENV: {
        default: process.env.NODE_ENV || "local",
        type: "string",
      } as StringConfig<keyof DeclaredEnvironments>,
    },
    name: "boilerplate",
    priorityInit: ["als", "configuration", "logger", "scheduler"],
    services: {
      /**
       * [AsyncLocalStorage](https://nodejs.org/api/async_context.html) hooks
       *
       * Use to pass data around bypassing business logic and insert data into logs
       */
      als: ALS,

      /**
       * @internal
       *
       * Exposed via `internal.boilerplate.configuration`
       *
       * Used to directly modify application configuration
       */
      configuration: Configuration,

      /**
       * @internal
       *
       * Exposed via `internal.boilerplate.logger`
       *
       * Used to modify the way the logger works at runtime
       */
      logger: Logger,

      /**
       * @internal
       *
       * Used to generate the scheduler that will get injected into other services
       */
      scheduler: Scheduler,
    },
  });
}

// (re)defined at bootstrap
// unclear if this variable even serves a purpose beyond types
export let LIB_BOILERPLATE: ReturnType<typeof createBoilerplate>;
type GenericApp = ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>;

const RUNNING_APPLICATIONS = new Map<string, GenericApp>();

// #MARK: QuickShutdown
async function quickShutdown(reason: string) {
  await each([...RUNNING_APPLICATIONS.values()], async application => {
    application.logger.warn({ reason }, `starting shutdown`);
    await application.teardown();
  });
}

// #MARK: processEvents
const processEvents = new Map([
  [
    "SIGTERM",
    async () => {
      await quickShutdown("SIGTERM");
      process.exit();
    },
  ],
  [
    "SIGINT",
    async () => {
      await quickShutdown("SIGINT");
      process.exit();
    },
  ],
  // ["uncaughtException", () => {}],
  // ["unhandledRejection", (reason, promise) => {}],
]);

const DECIMALS = 2;
const BOILERPLATE = (internal: InternalDefinition) =>
  internal.boot.loadedModules.get("boilerplate") as GetApis<ReturnType<typeof createBoilerplate>>;

// #MARK: CreateApplication
export function CreateApplication<S extends ServiceMap, C extends OptionalModuleConfiguration>({
  name,
  services = {} as S,
  configurationLoaders,
  libraries = [],
  configuration = {} as C,
  priorityInit = [],
}: ApplicationConfigurationOptions<S, C>) {
  let internal: InternalDefinition;

  if (!is.empty(priorityInit)) {
    priorityInit.forEach(name => {
      if (!is.function(services[name])) {
        throw new BootstrapException(
          WIRING_CONTEXT,
          "MISSING_PRIORITY_SERVICE",
          `${name} was listed as priority init, but was not found in services`,
        );
      }
    });
  }

  const serviceApis = {} as GetApisResult<ServiceMap>;
  const application = {
    [WIRE_PROJECT]: async (internal: InternalDefinition) => {
      BOILERPLATE(internal)?.configuration?.[LOAD_PROJECT](
        name as keyof LoadedModules,
        configuration,
      );
      await eachSeries(wireOrder(priorityInit, Object.keys(services)), async service => {
        serviceApis[service] = await wireService(
          name,
          service,
          services[service],
          internal.boot.lifecycle.events,
          internal,
        );
      });
      const append = internal.boot.options?.appendService;
      if (!is.empty(append)) {
        await eachSeries(Object.keys(append), async service => {
          await wireService(
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
      await bootstrap(application, options, internal);
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
    async teardown() {
      if (!application.booted) {
        processEvents.forEach((callback, event) => process.removeListener(event, callback));
        return;
      }
      await teardown(internal, application.logger);
      internal?.utils?.event?.removeAllListeners?.();
      application.booted = false;
      internal = undefined;
    },
    type: "application",
  } as unknown as ApplicationDefinition<S, C>;
  return application;
}

// #MARK: WireService
async function wireService(
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
    logger?.trace({ name: wireService }, `initializing`);
    const inject = Object.fromEntries(
      [...internal.boot.loadedModules.keys()].map(project => [
        project as keyof TServiceParams,
        internal.boot.loadedModules.get(project),
      ]),
    );

    loaded[service] = (await definition({
      ...inject,
      als: boilerplate.als,
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
    process.exit();
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
async function bootstrap<S extends ServiceMap, C extends OptionalModuleConfiguration>(
  application: ApplicationDefinition<S, C>,
  options: BootstrapOptions,
  internal: InternalDefinition,
) {
  const initTime = performance.now();
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
    const api = {} as GetApis<ReturnType<typeof createBoilerplate>>;
    internal.boilerplate = api;
    internal.boot.loadedModules.set("boilerplate", api);

    STATS.Construct = CONSTRUCT;
    // * Recreate base eventemitter
    internal.utils.event = new EventEmitter();
    internal.utils.event.setMaxListeners(NONE);
    // ? Some libraries need to be aware of

    // * Generate a new boilerplate module
    LIB_BOILERPLATE = createBoilerplate();

    // * Wire it
    let start = performance.now();
    await LIB_BOILERPLATE[WIRE_PROJECT](internal, wireService);

    CONSTRUCT.boilerplate = `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    // ~ configuration
    api.configuration?.[LOAD_PROJECT](LIB_BOILERPLATE.name, LIB_BOILERPLATE.configuration);
    const logger = api.logger.context(WIRING_CONTEXT);
    application.logger = logger;
    logger.info({ name: bootstrap }, `[boilerplate] wiring complete`);

    // * Wire in various shutdown events
    processEvents.forEach((callback, event) => {
      process.on(event, callback);
      logger.trace({ event, name: bootstrap }, "register shutdown event");
    });

    // * Add in libraries
    application.libraries ??= [];

    if (!is.undefined(options?.appendLibrary)) {
      const list = is.array(options.appendLibrary)
        ? options.appendLibrary
        : [options.appendLibrary];
      list.forEach(append => {
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

    const order = buildSortOrder(application, logger);
    await eachSeries(order, async i => {
      start = performance.now();
      logger.info({ name: bootstrap }, `[%s] init project`, i.name);
      await i[WIRE_PROJECT](internal, wireService);
      CONSTRUCT[i.name] = `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    });

    logger.trace({ name: bootstrap }, `library wiring complete`);

    // * Finally the application
    if (options?.bootLibrariesFirst) {
      logger.warn({ name: bootstrap }, `bootLibrariesFirst`);
      // * preload config
      api.configuration[LOAD_PROJECT](application.name, application.configuration);
    } else {
      logger.info({ name: bootstrap }, `init application`);
      start = performance.now();
      await application[WIRE_PROJECT](internal, wireService);
      CONSTRUCT[application.name] = `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    }

    // ? Configuration values provided bootstrap take priority over module level
    if (!is.empty(options?.configuration)) {
      api.configuration.merge(options?.configuration);
    }

    // - Kick off lifecycle
    logger.debug({ name: bootstrap }, `[PreInit] running lifecycle callbacks`);
    STATS.PreInit = await runPreInit(internal);
    // - Pull in user configurations
    logger.debug({ name: bootstrap }, "loading configuration");
    const config = BOILERPLATE(internal)?.configuration;
    STATS.Configure = await config?.[INITIALIZE](application);
    // - Run through other events in order
    logger.debug({ name: bootstrap }, `[PostConfig] running lifecycle callbacks`);

    STATS.PostConfig = await runPostConfig(internal);
    logger.debug({ name: bootstrap }, `[Bootstrap] running lifecycle callbacks`);
    STATS.Bootstrap = await runBootstrap(internal);

    if (options?.bootLibrariesFirst) {
      // * mental note
      // running between bootstrap & ready seems most appropriate
      // resources are expected to *technically* be ready at this point, but not finalized
      // reference examples:
      // - hass: socket is open & resources are ready
      // - fastify: bindings are available but port isn't listening

      logger.info({ name: bootstrap }, `late init application`);
      start = performance.now();
      await application[WIRE_PROJECT](internal, wireService);
      CONSTRUCT[application.name] = `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    }

    logger.debug({ name: bootstrap }, `[Ready] running lifecycle callbacks`);
    STATS.Ready = await runReady(internal);

    STATS.Total = `${(performance.now() - initTime).toFixed(DECIMALS)}ms`;
    // * App is ready!
    logger.info(
      options?.showExtraBootStats
        ? { ...STATS, name: bootstrap }
        : { Total: STATS.Total, name: bootstrap },
      `[%s] application bootstrapped`,
      application.name,
    );
    internal.boot.phase = "running";
  } catch (error) {
    if (options?.configuration?.boilerplate?.LOG_LEVEL !== "silent") {
      // eslint-disable-next-line no-console
      console.error("bootstrap failed", error);
    }

    process.exit();
  }
}

// #MARK: Teardown
async function teardown(internal: InternalDefinition, logger: ILogger) {
  // * Announce
  logger.warn({ name: teardown }, `received teardown request`);
  internal.boot.phase = "teardown";
  try {
    // * PreShutdown
    logger.debug({ name: teardown }, `[PreShutdown] running lifecycle callbacks`);
    await internal.boot.lifecycle.exec("PreShutdown");
    internal.boot.completedLifecycleEvents.add("PreShutdown");

    // * Formally shutting down
    logger.info({ name: teardown }, `tearing down application`);
    logger.debug({ name: teardown }, `[ShutdownStart] running lifecycle callbacks`);
    await internal.boot.lifecycle.exec("ShutdownStart");
    internal.boot.completedLifecycleEvents.add("ShutdownStart");

    // - clean up active `sleep` calls (can keep tests open and stuff)
    ACTIVE_SLEEPS.forEach(i => i.kill("stop"));

    logger.debug({ name: teardown }, `[ShutdownComplete] running lifecycle callbacks`);
    await internal.boot.lifecycle.exec("ShutdownComplete");
    internal.boot.completedLifecycleEvents.add("ShutdownComplete");
  } catch (error) {
    // ! oof
    global.console.error(
      { error },
      "error occurred during teardown, some lifecycle events may be incomplete",
    );
  }
  // * Final resource cleanup, attempt to reset everything possible

  logger.info(
    {
      name: teardown,
      started_at: internal.utils.relativeDate(internal.boot.startup),
    },
    `application terminated`,
  );
  processEvents.forEach((callback, event) => process.removeListener(event, callback));
}
