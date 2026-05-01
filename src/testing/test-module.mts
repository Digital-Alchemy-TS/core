/**
 * Test infrastructure for bootstrapping isolated DI graphs in test suites.
 *
 * @remarks
 * {@link TestRunner} boots a **real** dependency-injection graph, not a mock framework.
 * Every lifecycle stage fires in order, every service executes normally, and every
 * scheduler registers real event listeners. This makes it safe to test complex
 * initialization sequences, lifecycle interactions, and async service behavior without
 * leaking state between tests. By default, config files and environment variables
 * are NOT loaded; opt in with `loadConfigs: true` or `setOptions({ configSources })`.
 *
 * Always call `.teardown()` in `afterEach` — open handles and event listeners will
 * keep vitest hanging if left uncleaned.
 */

import { v4 } from "uuid";

import type {
  ApplicationDefinition,
  DataTypes,
  ILogger,
  LibraryDefinition,
  LoggerOptions,
  ModuleConfiguration,
  OptionalModuleConfiguration,
  PartialConfiguration,
  ServiceFunction,
  ServiceMap,
  TConfigLogLevel,
  TLibrary,
  TServiceParams,
} from "../index.mts";
import { CreateApplication, CreateLibrary, deepExtend, is, NONE } from "../index.mts";

export type CreateTestingLibraryOptions<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = {
  /**
   * default: testing
   */
  name?: string;
  target?: LibraryDefinition<S, C> | ApplicationDefinition<S, C>;
};

type TestingBootstrapOptions = {
  /**
   * default: false
   *
   * Set to true to have this test emit logs to stdout. Useful for debugging
   * test failures during interactive development.
   */
  emitLogs?: boolean;

  /**
   * Pass through to bootstrap params to customize logger output behavior.
   */
  loggerOptions?: LoggerOptions;

  /**
   * default: false
   *
   * Whether to load config from environment variables and config files.
   * By default, all config sources are disabled — the test environment
   * is isolated. Opt in with `loadConfigs: true` or individual sources
   * via `setOptions({ configSources: { env: true } })`.
   */
  loadConfigs?: boolean;

  /**
   * Replacement logger object to use instead of the default no-op logger.
   *
   * default: **no-op ILogger** (all methods are stubs)
   */
  customLogger?: ILogger;

  /**
   * Matches regular bootstrap options for library load ordering.
   */
  bootLibrariesFirst?: boolean;

  /**
   * Default values to use for configurations, applied before user values.
   * Deep-merged into the module configuration during bootstrap.
   */
  configuration?: PartialConfiguration;

  /**
   * @internal
   *
   * Explicit module configuration for the test runner. Only set this if you
   * need to control the raw configuration shape; normally use `.configure()`
   * instead.
   */
  module_config?: ModuleConfiguration;

  /**
   * Control which config sources are loaded by the test runner.
   * Defaults to **all disabled** unless `loadConfigs: true` is passed.
   *
   * Example: `setOptions({ configSources: { env: true } })` enables
   * environment variable loading without file loading.
   */
  configSources?: Partial<Record<DataTypes, boolean>>;
};

export type LibraryTestRunner<T> =
  T extends LibraryDefinition<infer S, infer C> ? iTestRunner<S, C> : never;
export type ApplicationTestRunner<T> =
  T extends ApplicationDefinition<infer S, infer C> ? iTestRunner<S, C> : never;

export type iTestRunner<S extends ServiceMap, C extends OptionalModuleConfiguration> = {
  /**
   * Merge configuration values into the test runner's config.
   *
   * @remarks
   * Chained calls deep-merge together; order is left-to-right.
   * Configuration is applied at bootstrap time via `onPostConfig`.
   */
  configure: (configuration: PartialConfiguration) => iTestRunner<S, C>;

  /**
   * Merge bootstrap options into the test runner.
   *
   * @remarks
   * Chained calls deep-merge together. Use this to set logging behavior,
   * config sources, and other bootstrap-level parameters.
   */
  setOptions: (options: TestingBootstrapOptions) => iTestRunner<S, C>;

  /**
   * Enable library-first bootstrap order for this test.
   *
   * @remarks
   * Sets `bootLibrariesFirst: true` in the bootstrap options.
   */
  bootLibrariesFirst: () => iTestRunner<S, C>;

  /**
   * Enable logger output and optionally set the log level.
   *
   * @remarks
   * Convenience method for debugging test failures. Sets `emitLogs: true`
   * and optionally sets `boilerplate.LOG_LEVEL` if a level is provided.
   */
  emitLogs: (log_level?: TConfigLogLevel) => iTestRunner<S, C>;

  /**
   * Register a service function to execute first during bootstrap.
   *
   * @remarks
   * Chained calls add multiple setup functions; they execute in order
   * via a synthetic `run_first` library that depends on all target libraries.
   */
  setup: (test: ServiceFunction) => iTestRunner<S, C>;

  /**
   * Bootstrap and return the fully-wired {@link TServiceParams} without running an inline service.
   *
   * @remarks
   * Cannot be used with `.run()`; they are mutually exclusive. Useful when
   * you need to pass the params to multiple service calls or assertions.
   * Always call `.teardown()` after you're done with the params.
   */
  serviceParams: () => Promise<TServiceParams>;

  /**
   * Bootstrap the test application and run the provided test service.
   *
   * @remarks
   * Cannot be used with `.serviceParams()`; they are mutually exclusive.
   * Returns the application so you can make assertions on its state after
   * the test service completes. The returned app already has `.teardown()`
   * wired to this runner; call it in `afterEach` to clean up.
   *
   * @throws Propagates any error thrown by the test service or during bootstrap.
   */
  run: (
    test: ServiceFunction,
  ) => Promise<ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>>;

  /**
   * Register an additional library to wire into the test application.
   *
   * @remarks
   * The library is appended to the dependency list; chained calls add
   * multiple libraries. Useful for mocking or providing test doubles
   * without modifying the target module's definition.
   */
  appendLibrary: (library: TLibrary) => iTestRunner<S, C>;

  /**
   * Inject an extra service into the test application.
   *
   * @remarks
   * The service is added to the application's service map by name.
   * If `name` is not provided, the function's `.name` property is used;
   * if that's empty, a UUID is generated. Chained calls add multiple services.
   */
  appendService: (service: ServiceFunction, name?: string) => iTestRunner<S, C>;

  /**
   * Substitute a library by name.
   *
   * @remarks
   * Any library in the target module or appended libraries with matching name
   * is replaced by the provided library. Chained calls build a replacement map.
   */
  replaceLibrary: (name: string, library: TLibrary) => iTestRunner<S, C>;

  /**
   * Tear down the bootstrapped application and clean up all resources.
   *
   * @remarks
   * Closes event listeners, cancels schedulers, and flushes any pending
   * async work. **CRITICAL:** Call this in `afterEach` to prevent vitest
   * hangs from unclosed file handles or event emitters. Safe to call
   * multiple times (idempotent).
   */
  teardown: () => Promise<void>;

  type: "test";
};

/**
 * Bootstrap a real dependency-injection graph for testing.
 *
 * @remarks
 * Returns a chainable test runner that wires up a full application with all
 * lifecycle stages executing in order. By default, config files and environment
 * variables are NOT loaded — the test is isolated. Opt in with `loadConfigs: true`
 * or `setOptions({ configSources: { env: true } })`.
 *
 * **Mocking depth matters:** when you spy on a service method, only that method
 * is replaced, not the entire service. To substitute an entire service, use
 * `.replaceLibrary()` or `.appendService()`.
 *
 * **CRITICAL:** Always call `.teardown()` in `afterEach`. Unclosed event listeners
 * and scheduled tasks will hang the test runner.
 */
export function TestRunner<S extends ServiceMap, C extends OptionalModuleConfiguration>(
  options: CreateTestingLibraryOptions<S, C> = {},
) {
  // disable max event listener warnings in test environments where many
  // services register lifecycle callbacks and event handlers simultaneously
  process.setMaxListeners(NONE);
  let teardown: () => Promise<void>;
  let bootOptions: TestingBootstrapOptions = {};
  const appendLibraries = new Map<string, TLibrary>();
  const appendServices = new Map<string, ServiceFunction>();
  const replaceLibrary = new Map<string, TLibrary>();
  const runFirst = new Set<ServiceFunction>();

  function getLibraries(target: LibraryDefinition<S, C> | ApplicationDefinition<S, C>) {
    if (target && "depends" in target) {
      return target.depends ?? [];
    }
    return target && "libraries" in target ? target.libraries : [];
  }

  function buildApp(
    name: string,
    target: LibraryDefinition<S, C> | ApplicationDefinition<S, C>,
    test: ServiceFunction,
  ) {
    // extract optional dependencies from the target; absent if target is undefined
    const optional = target && "optionalDepends" in target ? target.optionalDepends : [];
    // gather the full library dependency tree from the target module
    const depends = [...getLibraries(target)];

    // wrap the target's services and configuration into a library so it can be
    // mixed with appended libraries and the run_first setup library
    const testLibrary = target
      ? CreateLibrary({
          configuration: target.configuration,
          depends,
          name: target.name,
          optionalDepends: optional,
          priorityInit: target.priorityInit,
          services: target.services,
        })
      : undefined;
    // setup services (added via .setup()) run in a dedicated library that depends
    // on the target library, ensuring they fire after the full graph is wired
    let LIB_RUN_FIRST: TLibrary;
    if (!is.empty(runFirst)) {
      LIB_RUN_FIRST = CreateLibrary({
        depends: testLibrary ? [testLibrary, ...depends] : [...depends],
        // @ts-expect-error nothing useful here
        name: "run_first",
        services: Object.fromEntries(
          [...runFirst.values()].map(
            service => [service.name || v4(), service] as [string, ServiceFunction],
          ),
        ) as ServiceMap,
      });
    }

    // build the application with appended libraries, the target library (if any),
    // and the special test service that the caller provides to .run() or .serviceParams()
    const app = CreateApplication({
      configuration: bootOptions?.module_config ?? {},
      // pass config sources from options; if loadConfigs is not set, all sources default to false
      configurationLoaders: bootOptions?.configSources,
      libraries: [
        // map any replaced libraries; use the replacement if it exists in replaceLibrary map
        ...(is.empty(depends)
          ? []
          : depends.map(i => (replaceLibrary.has(i.name) ? replaceLibrary.get(i.name) : i))),
        // include the target library to ensure its services and config are wired
        ...(testLibrary ? [testLibrary] : []),
      ],
      // @ts-expect-error it's life
      name,
      // inject the test service so it receives TServiceParams at bootstrap time
      services: { test },
    });

    return { LIB_RUN_FIRST, app };
  }

  const libraryTestRunner: iTestRunner<S, C> = {
    appendLibrary(library: TLibrary) {
      // store the library for wiring during bootstrap
      appendLibraries.set(library.name, library);
      return libraryTestRunner;
    },
    appendService(service: ServiceFunction, name?: string) {
      // use the service's own function name if no explicit name was provided
      if (is.empty(name) && !is.empty(service.name)) {
        name = service.name;
      }
      // store the service for wiring; generate a UUID only if name is still empty
      appendServices.set(name || v4(), service);
      return libraryTestRunner;
    },
    bootLibrariesFirst() {
      // set the flag to control library initialization order during bootstrap
      bootOptions.bootLibrariesFirst = true;
      return libraryTestRunner;
    },
    configure(configuration: PartialConfiguration) {
      // deep-merge the configuration into existing boot options
      bootOptions = deepExtend(bootOptions, { configuration });
      return libraryTestRunner;
    },
    emitLogs(LOG_LEVEL: TConfigLogLevel) {
      // enable logger output for debugging
      libraryTestRunner.setOptions({ emitLogs: true });
      // only set log level if a specific level was provided
      if (!is.empty({ level: LOG_LEVEL })) {
        libraryTestRunner.configure({ boilerplate: { LOG_LEVEL } });
      }
      return libraryTestRunner;
    },
    replaceLibrary(name: string, library: TLibrary) {
      // store the replacement; lookup happens during app construction
      replaceLibrary.set(name, library);
      return libraryTestRunner;
    },
    async run(test: ServiceFunction) {
      // build the application with all configured libraries, services, and the test service
      const { app, LIB_RUN_FIRST } = buildApp(options?.name ?? "testing", options?.target, test);
      // bootstrap the full application; all lifecycle stages fire here
      await app.bootstrap({
        appendLibrary: [...appendLibraries.values(), ...(LIB_RUN_FIRST ? [LIB_RUN_FIRST] : [])],
        appendService: Object.fromEntries(appendServices.entries()),
        bootLibrariesFirst: !!bootOptions?.bootLibrariesFirst,
        configSources: bootOptions?.configSources,
        configuration: bootOptions?.configuration,
        // if logging is disabled, provide a no-op logger; otherwise use the provided custom logger or default
        customLogger: bootOptions?.emitLogs
          ? undefined
          : (bootOptions?.customLogger ?? {
              debug: () => {},
              error: () => {},
              fatal: () => {},
              info: () => {},
              trace: () => {},
              warn: () => {},
            }),
        loggerOptions: bootOptions?.loggerOptions,
      });

      // capture the teardown function so callers can clean up after the test
      teardown = async () => await app.teardown();
      return app;
    },
    serviceParams() {
      // wrap a service that returns its TServiceParams immediately; run() will inject them
      return new Promise<TServiceParams>(done => libraryTestRunner.run(done));
    },
    setOptions(options: TestingBootstrapOptions) {
      // deep-merge bootstrap options; chained calls accumulate settings
      bootOptions = deepExtend(bootOptions, options);
      return libraryTestRunner;
    },
    setup(service: ServiceFunction) {
      // register the service to run first; it will be added to LIB_RUN_FIRST during buildApp
      runFirst.add(service);
      return libraryTestRunner;
    },
    async teardown() {
      // close all event listeners, cancel schedulers, and clean up async work
      if (teardown) {
        await teardown();
        teardown = undefined;
      }
    },
    type: "test",
  };
  return libraryTestRunner;
}
