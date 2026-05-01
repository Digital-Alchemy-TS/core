import { EventEmitter } from "node:events";

import type {
  ApplicationConfigurationOptions,
  ApplicationDefinition,
  BootstrapOptions,
  GetApis,
  GetApisResult,
  ILogger,
  LoadedModules,
  OptionalModuleConfiguration,
  ServiceFunction,
  ServiceMap,
  StringConfig,
  TConfigLogLevel,
  TLifecycleBase,
  TServiceParams,
  TServiceReturn,
} from "../index.mts";
import {
  ACTIVE_SLEEPS,
  BootstrapException,
  buildSortOrder,
  COERCE_CONTEXT,
  CreateLibrary,
  each,
  eachSeries,
  fatalLog,
  NONE,
  SINGLE,
  WIRE_PROJECT,
  wireOrder,
  WIRING_CONTEXT,
} from "../index.mts";
import { ALS } from "./als.service.mts";
import {
  Configuration,
  INITIALIZE,
  INJECTED_DEFINITIONS,
  LOAD_PROJECT,
} from "./configuration.service.mts";
import { InternalDefinition } from "./internal.service.mts";
// direct import of `is` from its source file to avoid a circular dependency:
// going through ../index.mts would force wiring.mts to resolve before is.service.mts
import { is } from "./is.service.mts";
import { CreateLifecycle } from "./lifecycle.service.mts";
import { Logger } from "./logger.service.mts";
import { Scheduler } from "./scheduler.service.mts";

export interface DeclaredEnvironments {
  prod: true;
  test: true;
  local: true;
}

const EXIT_ERROR = 1;
const SIGINT = 130;
const SIGTERM = 143;

// #MARK: CreateBoilerplate
/**
 * Construct a fresh `LIB_BOILERPLATE` library definition.
 *
 * @remarks
 * Must remain in this file. Moving it to another module causes code-init race
 * conditions because the boilerplate services depend on types that are only
 * resolved after the module graph is fully settled. The library is recreated
 * on every `bootstrap()` call so tests get a clean instance.
 *
 * @internal
 */
function createBoilerplate() {
  // ! DO NOT MOVE TO ANOTHER FILE !
  // While it SEEMS LIKE this can be safely moved, it causes code init race conditions.
  return CreateLibrary({
    configuration: {
      /**
       * Only usable by **cli switch** / application bootstrap.
       * Pass path to a config file for loader
       *
       * ```bash
       * node dist/app.js --config ~/.config/my_app.ini
       * ```
       */
      CONFIG: {
        description: [
          "If provided, all other file based configurations will be ignored",
          "Environment variables + CLI switches will operate normally",
        ].join(". "),
        source: ["argv"],
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

// (re)defined at bootstrap; exported so downstream code can reference its type
export let LIB_BOILERPLATE: ReturnType<typeof createBoilerplate>;
type GenericApp = ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>;
const RUNNING_APPLICATIONS = new Map<string, GenericApp>();

// #MARK: QuickShutdown
/**
 * Trigger teardown on every currently-running application.
 *
 * @remarks
 * Called by the SIGINT/SIGTERM process event handlers so all applications
 * go through their full shutdown lifecycle before the process exits.
 *
 * @internal
 */
async function quickShutdown(reason: string) {
  await each([...RUNNING_APPLICATIONS.values()], async application => {
    application.logger.warn({ reason }, `starting shutdown`);
    await application.teardown();
  });
}

// #MARK: processEvents
// SIGTERM is sent by orchestrators (e.g. Docker, Kubernetes) for graceful shutdown;
// SIGINT is sent by the terminal (Ctrl-C); both should drain the lifecycle cleanly
// before exiting rather than killing the process immediately
const processEvents = new Map([
  [
    "SIGTERM",
    async () => {
      await quickShutdown("SIGTERM");
      process.exit(SIGTERM);
    },
  ],
  [
    "SIGINT",
    async () => {
      await quickShutdown("SIGINT");
      process.exit(SIGINT);
    },
  ],
  // ["uncaughtException", () => {}],
  // ["unhandledRejection", (reason, promise) => {}],
]);

const DECIMALS = 2;
const BOILERPLATE = (internal: InternalDefinition) =>
  internal.boot.loadedModules.get("boilerplate") as GetApis<ReturnType<typeof createBoilerplate>>;

// #MARK: CreateApplication
/**
 * Define an application and return a handle that can be bootstrapped.
 *
 * @remarks
 * Does not start any services. Call `.bootstrap(options)` on the returned
 * handle to wire services and run the lifecycle. Only one bootstrap per
 * handle is allowed; a second call throws `DOUBLE_BOOT`.
 *
 * The returned handle also exposes `.teardown()` for orderly shutdown —
 * this is the same path taken by the SIGINT/SIGTERM handlers.
 *
 * `priorityInit` controls which services are wired first within this
 * application; all others are wired in declaration order after them.
 *
 * @throws {BootstrapException} `MISSING_PRIORITY_SERVICE` if a service listed
 *   in `priorityInit` is not present in `services`.
 */
export function CreateApplication<S extends ServiceMap, C extends OptionalModuleConfiguration>({
  name,
  services = {} as S,
  libraries = [],
  configuration = {} as C,
  priorityInit = [],
  ...extra
}: ApplicationConfigurationOptions<S, C>) {
  let internal: InternalDefinition;

  // validate priority list up front so misconfiguration fails loudly at definition
  // time rather than silently during bootstrap when the service is just missing
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
    // * Merge in stuff which may only exist via declaration merging
    ...extra,
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
      // appendService allows tests (and advanced users) to inject extra services
      // without modifying the application definition
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
      // guard against accidentally bootstrapping the same application twice;
      // this is always a programming error — each app should have a single entry point
      if (application.booted) {
        throw new BootstrapException(
          WIRING_CONTEXT,
          "DOUBLE_BOOT",
          "Application is already booted! Cannot bootstrap again",
        );
      }
      internal = new InternalDefinition();
      internal.utils.is = is;
      const out = await bootstrap(application, options, internal);
      application.booted = true;
      RUNNING_APPLICATIONS.set(name, application);
      return out;
    },
    configuration,
    libraries,
    logger: undefined,
    name,
    priorityInit,
    serviceApis,
    services,
    async teardown() {
      if (!application.booted) {
        // remove signal handlers even for un-booted teardown so they don't
        // accumulate across test re-runs
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
/**
 * Instantiate a single service function and register it in the module registry.
 *
 * @remarks
 * Builds the full `TServiceParams` injection object from the currently loaded
 * modules and calls the service factory. The returned value is stored in
 * `internal.boot.loadedModules` so subsequent services can reference it.
 *
 * Construction time is recorded for bootstrap stats (`showExtraBootStats`).
 *
 * If the factory throws, the error is treated as fatal — the process exits
 * with code 1 because a failed constructor leaves the DI graph in a
 * partially-initialized state with no safe recovery path.
 *
 * @internal
 */
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

  // logger is not yet available at the very start of bootstrap; only undefined briefly
  // during boilerplate wiring before the logger service itself is initialized
  const boilerplate = BOILERPLATE(internal);
  const logger = boilerplate?.logger?.context(context);
  const loaded = internal.boot.loadedModules.get(project) ?? {};
  internal.boot.loadedModules.set(project, loaded);
  try {
    logger?.trace({ name: wireService }, `initializing`);
    const serviceStart = performance.now();
    // snapshot all currently-loaded modules so each service sees siblings
    // that were wired before it, but not ones that come after (no forward refs)
    const inject = Object.fromEntries(
      [...internal.boot.loadedModules.keys()].map(project => [
        project as keyof TServiceParams,
        internal.boot.loadedModules.get(project),
      ]),
    );

    const serviceParams = {
      ...inject,
      als: boilerplate.als,
      config: boilerplate?.configuration?.[INJECTED_DEFINITIONS],
      context,
      event: internal?.utils?.event,
      internal,
      lifecycle,
      logger,
      params: undefined,
      // scheduler is a builder; call it with context so the returned API
      // tags every scheduled callback with this service's context string
      scheduler: boilerplate?.scheduler?.(context),
    } as TServiceParams;
    // params.params is a self-reference so callers can spread the whole bundle
    serviceParams.params = serviceParams;

    loaded[service] = (await definition(serviceParams)) as TServiceReturn;

    const serviceDuration = performance.now() - serviceStart;
    internal.boot.serviceConstructionTimes.push({
      duration: `${serviceDuration.toFixed(DECIMALS)}ms`,
      module: project,
      service,
    });

    return loaded[service];
  } catch (error) {
    // constructor errors are blocking — a partially-initialized service graph
    // cannot be safely recovered, so exit immediately
    fatalLog("initialization error", error);
    process.exit(EXIT_ERROR);
  }
}

/**
 * Execute the `PreInit` lifecycle stage and mark it complete.
 * @internal
 */
const runPreInit = async (internal: InternalDefinition) => {
  const duration = await internal.boot.lifecycle.exec("PreInit");
  internal.boot.completedLifecycleEvents.add("PreInit");
  return duration;
};

/**
 * Execute the `PostConfig` lifecycle stage and mark it complete.
 * @internal
 */
const runPostConfig = async (internal: InternalDefinition) => {
  const duration = await internal.boot.lifecycle.exec("PostConfig");
  internal.boot.completedLifecycleEvents.add("PostConfig");
  return duration;
};

/**
 * Execute the `Bootstrap` lifecycle stage and mark it complete.
 * @internal
 */
const runBootstrap = async (internal: InternalDefinition) => {
  const duration = await internal.boot.lifecycle.exec("Bootstrap");
  internal.boot.completedLifecycleEvents.add("Bootstrap");
  return duration;
};

/**
 * Execute the `Ready` lifecycle stage and mark it complete.
 * @internal
 */
const runReady = async (internal: InternalDefinition) => {
  const duration = await internal.boot.lifecycle.exec("Ready");
  internal.boot.completedLifecycleEvents.add("Ready");
  return duration;
};

// #MARK: Bootstrap
/**
 * Wire all services for an application, run the full lifecycle, and return
 * the `TServiceParams` for the bootstrap service.
 *
 * @remarks
 * Sequence:
 * 1. Initialize a fresh `InternalDefinition.boot` record.
 * 2. Wire boilerplate (als, configuration, logger, scheduler).
 * 3. Register SIGINT/SIGTERM process event handlers for graceful shutdown.
 * 4. Wire declared libraries in dependency-sorted order.
 * 5. Wire the application services (or defer to after Bootstrap if
 *    `bootLibrariesFirst` is set).
 * 6. Apply any inline `options.configuration` overrides.
 * 7. Run `PreInit → Configure (loaders) → PostConfig → Bootstrap → Ready`.
 * 8. Resolve the returned `TServiceParams` promise via a synthetic
 *    "bootstrap" service wire call so the caller can access the wired graph.
 *
 * @internal
 */
async function bootstrap<S extends ServiceMap, C extends OptionalModuleConfiguration>(
  application: ApplicationDefinition<S, C>,
  options: BootstrapOptions,
  internal: InternalDefinition,
): Promise<TServiceParams> {
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
    serviceConstructionTimes: [],
    startup: new Date(),
  };

  process.title = application.name;
  try {
    const STATS = {} as Record<string, unknown>;
    const CONSTRUCT = {} as Record<string, unknown>;

    // pre-create loaded module for boilerplate, so it can be attached to `internal`
    // before the boilerplate services themselves are wired; without this pre-seeding
    // the boilerplate services would not find each other in the module map
    const api = {} as GetApis<ReturnType<typeof createBoilerplate>>;
    internal.boilerplate = api;
    internal.boot.loadedModules.set("boilerplate", api);

    STATS.Construct = CONSTRUCT;
    // * Recreate base eventemitter
    internal.utils.event = new EventEmitter();
    // unlimited listeners: every service can register lifecycle hooks, and the
    // default cap of 10 would produce spurious MaxListenersExceededWarnings
    internal.utils.event.setMaxListeners(NONE);

    // * Generate a new boilerplate module
    LIB_BOILERPLATE = createBoilerplate();

    // * Wire it
    let start = performance.now();
    await LIB_BOILERPLATE[WIRE_PROJECT](internal, wireService);

    CONSTRUCT.boilerplate = `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    // sync convenience aliases so downstream code reaches config via either path
    internal.config = api.configuration;
    // ~ configuration
    api.configuration?.[LOAD_PROJECT](LIB_BOILERPLATE.name, LIB_BOILERPLATE.configuration);
    const logger = api.logger.context(WIRING_CONTEXT);
    application.logger = logger;
    logger.debug({ name: bootstrap }, `[boilerplate] wiring complete`);

    // register signal handlers now that the logger is available so teardown
    // log lines are visible; handlers are removed on teardown/un-booted teardown
    processEvents.forEach((callback, event) => {
      process.on(event, callback);
      logger.trace({ event, name: bootstrap }, "register shutdown event");
    });

    // * Add in libraries
    application.libraries ??= [];

    // appendLibrary allows replacing a library at bootstrap time, which is
    // the primary mechanism for injecting test doubles at the library level
    if (!is.undefined(options?.appendLibrary)) {
      const list = is.array(options.appendLibrary)
        ? options.appendLibrary
        : [options.appendLibrary];
      list.forEach(append => {
        application.libraries.some((library, index) => {
          if (append.name === library.name) {
            // remove existing entry so the appended version takes its slot
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

    // sort libraries so each one is wired after its declared dependencies
    const order = buildSortOrder(application, logger);
    await eachSeries(order, async i => {
      start = performance.now();
      logger.debug({ name: bootstrap }, `[%s] init project`, i.name);
      await i[WIRE_PROJECT](internal, wireService);
      CONSTRUCT[i.name] = `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    });

    logger.trace({ name: bootstrap }, `library wiring complete`);

    // * Finally the application
    if (options?.bootLibrariesFirst) {
      logger.debug({ name: bootstrap }, `bootLibrariesFirst`);
      // bootLibrariesFirst: skip application wiring here and run it later,
      // between Bootstrap and Ready, so the app sees fully-initialized library services
      api.configuration[LOAD_PROJECT](application.name, application.configuration);
    } else {
      logger.debug({ name: bootstrap }, `init application`);
      start = performance.now();
      await application[WIRE_PROJECT](internal, wireService);
      CONSTRUCT[application.name] = `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    }

    // ? Configuration values provided at bootstrap take priority over module-level defaults
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
      // wire the application between Bootstrap and Ready so library resources are
      // fully initialized (e.g. hass socket open, fastify bindings registered)
      // but the app itself does not start accepting work until Ready fires

      logger.debug({ name: bootstrap }, `late init application`);
      start = performance.now();
      await application[WIRE_PROJECT](internal, wireService);
      CONSTRUCT[application.name] = `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    }

    logger.debug({ name: bootstrap }, `[Ready] running lifecycle callbacks`);
    STATS.Ready = await runReady(internal);

    STATS.Total = `${(performance.now() - initTime).toFixed(DECIMALS)}ms`;

    // Add config timings if available
    if (internal.boot.configTimings) {
      STATS.config = internal.boot.configTimings;
    }

    // * App is ready!
    logger.info(
      options?.showExtraBootStats
        ? {
            ...STATS,
            Construct: {
              ...CONSTRUCT,
              services: internal.boot.serviceConstructionTimes,
            },
            name: bootstrap,
          }
        : { Total: STATS.Total, name: bootstrap },
      `[%s] application bootstrapped`,
      application.name,
    );
    internal.boot.phase = "running";
    // resolve the bootstrap promise by wiring a synthetic "bootstrap" service
    // whose params object is the fully-wired TServiceParams the caller receives
    return new Promise(done =>
      wireService(
        application.name,
        "bootstrap",
        i => done(i),
        internal.boot.lifecycle.events,
        internal,
      ),
    );
  } catch (error) {
    if (options?.configuration?.boilerplate?.LOG_LEVEL !== "silent") {
      fatalLog("bootstrap failed", error);
    }
    process.exit(EXIT_ERROR);
  }
}

// #MARK: Teardown
/**
 * Run shutdown lifecycle stages and clean up process-level resources.
 *
 * @remarks
 * Called by `.teardown()` on the application handle and indirectly by the
 * SIGINT/SIGTERM handlers via `quickShutdown`. Idempotent at the phase check
 * — only executes if the application is in the `"running"` phase.
 *
 * Sequence: `PreShutdown → ShutdownStart → (cancel active sleeps) →
 * ShutdownComplete`. Any error during teardown is logged to stderr via
 * `globalThis.console.error` because the logger itself may be in an
 * indeterminate state at that point.
 *
 * @internal
 */
async function teardown(internal: InternalDefinition, logger: ILogger) {
  // skip if the app never fully started or has already been torn down
  if (internal.boot.phase !== "running") {
    return;
  }
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

    // cancel any in-flight sleep() calls; without this they keep the event loop
    // alive and hang test runners / process exits
    ACTIVE_SLEEPS.forEach(i => i.kill("stop"));

    logger.debug({ name: teardown }, `[ShutdownComplete] running lifecycle callbacks`);
    await internal.boot.lifecycle.exec("ShutdownComplete");
    internal.boot.completedLifecycleEvents.add("ShutdownComplete");
  } catch (error) {
    // teardown errors are logged via globalThis.console rather than logger because
    // the logger service itself may have been partially torn down by this point
    globalThis.console.error(
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
  // deregister signal handlers so they don't fire again if the process receives
  // another signal after teardown completes
  processEvents.forEach((callback, event) => process.removeListener(event, callback));
}
