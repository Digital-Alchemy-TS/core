import { v4 } from "uuid";

import {
  ApplicationDefinition,
  ConfigLoader,
  CreateLibrary,
  deepExtend,
  ILogger,
  LibraryDefinition,
  LoggerOptions,
  ModuleConfiguration,
  NONE,
  OptionalModuleConfiguration,
  PartialConfiguration,
  ServiceFunction,
  ServiceMap,
  TConfigLogLevel,
  TLibrary,
} from "../helpers";
import { CreateApplication, is } from "../services";

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
   * set to true to have this test emit logs
   */
  emitLogs?: boolean;

  /**
   * mostly useful for testing deep internals
   */
  configLoader?: ConfigLoader;

  /**
   * pass through to bootstrap params
   */
  loggerOptions?: LoggerOptions;

  /**
   * default: false
   *
   * Should testing apps consider config file / environment variables?
   */
  loadConfigs?: boolean;

  /**
   * replacement logger object to use
   *
   * default: **NOOP**
   */
  customLogger?: ILogger;

  /**
   * matches regular bootstrap options
   */
  bootLibrariesFirst?: boolean;

  /**
   * default values to use for configurations, before user values come in
   */
  configuration?: PartialConfiguration;

  /**
   * @internal
   *
   * define a configuration for the unit tests
   *
   * > **note**: you probably don't need to do this, it's not even documented
   */
  module_config?: ModuleConfiguration;
};

export type LibraryTestRunner<T> =
  T extends LibraryDefinition<infer S, infer C> ? iTestRunner<S, C> : never;
export type ApplicationTestRunner<T> =
  T extends ApplicationDefinition<infer S, infer C> ? iTestRunner<S, C> : never;

export type iTestRunner<S extends ServiceMap, C extends OptionalModuleConfiguration> = {
  /**
   * chained calls deep merge options together
   */
  configure: (configuration: PartialConfiguration) => iTestRunner<S, C>;

  /**
   * chained calls deep merge options together
   */
  setOptions: (options: TestingBootstrapOptions) => iTestRunner<S, C>;

  /**
   * sets flag to true
   */
  bootLibrariesFirst: () => iTestRunner<S, C>;

  /**
   * for debugging, single command to enable logging on this test
   */
  emitLogs: (log_level?: TConfigLogLevel) => iTestRunner<S, C>;

  /**
   * chained calls add multiple setup functions
   */
  setup: (test: ServiceFunction) => iTestRunner<S, C>;

  /**
   * returns reference to app that was booted
   */
  run: (
    test: ServiceFunction,
  ) => Promise<ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>>;

  /**
   * add a library to the runner beyond what the target module requested
   */
  appendLibrary: (library: TLibrary) => iTestRunner<S, C>;

  /**
   * inject an extra service to your module
   *
   * by default will take the function name as context, can optionally provide the name as 2nd param (if it even matters)
   */
  appendService: (service: ServiceFunction, name?: string) => iTestRunner<S, C>;

  /**
   * substitute a library for another by name
   */
  replaceLibrary: (name: string, library: TLibrary) => iTestRunner<S, C>;

  /**
   * substitute a service for another in your module
   *
   * does not check if the substitution is valid
   */
  replaceService: (name: string, service: ServiceFunction) => iTestRunner<S, C>;

  /**
   * reference to the app teardown internally
   *
   * clean up your testing resources!
   */
  teardown: () => Promise<void>;

  type: "test";
};

/**
 * library optional
 */
export function TestRunner<S extends ServiceMap, C extends OptionalModuleConfiguration>(
  options: CreateTestingLibraryOptions<S, C> = {},
) {
  process.setMaxListeners(NONE);
  let teardown: () => Promise<void>;
  let bootOptions: TestingBootstrapOptions = {};
  const appendLibraries = new Map<string, TLibrary>();
  const appendServices = new Map<string, ServiceFunction>();
  const replaceLibrary = new Map<string, TLibrary>();
  const replaceService = new Map<string, ServiceFunction>();
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
    const optional = target && "optionalDepends" in target ? target.optionalDepends : [];
    const depends = [...getLibraries(target)];

    const testLibrary = target
      ? CreateLibrary({
          configuration: target.configuration,
          depends,
          name: target.name,
          optionalDepends: optional,
          priorityInit: target.priorityInit,
          services: Object.fromEntries(
            Object.entries(target.services).map(([name, service]) => [
              name,
              replaceService.has(name) ? replaceService.get(name) : service,
            ]),
          ) as S,
        })
      : undefined;
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

    const customLoader = bootOptions?.configLoader ? [bootOptions?.configLoader] : [];
    const app = CreateApplication({
      configuration: bootOptions?.module_config ?? {},
      configurationLoaders: bootOptions?.loadConfigs ? undefined : customLoader,
      libraries: [
        ...(is.empty(depends)
          ? []
          : depends.map(i => (replaceLibrary.has(i.name) ? replaceLibrary.get(i.name) : i))),
        ...(testLibrary ? [testLibrary] : []),
      ],
      // @ts-expect-error it's life
      name,
      services: { test },
    });

    return { LIB_RUN_FIRST, app };
  }

  const libraryTestRunner: iTestRunner<S, C> = {
    appendLibrary(library: TLibrary) {
      appendLibraries.set(library.name, library);
      return libraryTestRunner;
    },
    appendService(service: ServiceFunction, name?: string) {
      if (is.empty(name) && !is.empty(service.name)) {
        name = service.name;
      }
      appendServices.set(name || v4(), service);
      return libraryTestRunner;
    },
    bootLibrariesFirst() {
      bootOptions.bootLibrariesFirst = true;
      return libraryTestRunner;
    },
    configure(configuration: PartialConfiguration) {
      bootOptions = deepExtend(bootOptions, { configuration });
      return libraryTestRunner;
    },
    emitLogs(LOG_LEVEL: TConfigLogLevel) {
      libraryTestRunner.setOptions({ emitLogs: true });
      if (!is.empty({ level: LOG_LEVEL })) {
        libraryTestRunner.configure({ boilerplate: { LOG_LEVEL } });
      }
      return libraryTestRunner;
    },
    replaceLibrary(name: string, library: TLibrary) {
      replaceLibrary.set(name, library);
      return libraryTestRunner;
    },
    replaceService(name: string, service: ServiceFunction) {
      replaceService.set(name, service);
      return libraryTestRunner;
    },
    async run(test: ServiceFunction) {
      const { app, LIB_RUN_FIRST } = buildApp(options?.name ?? "testing", options?.target, test);
      await app.bootstrap({
        appendLibrary: [...appendLibraries.values(), ...(LIB_RUN_FIRST ? [LIB_RUN_FIRST] : [])],
        appendService: Object.fromEntries(appendServices.entries()),
        bootLibrariesFirst: !!bootOptions?.bootLibrariesFirst,
        configuration: bootOptions?.configuration,
        customLogger: bootOptions?.emitLogs
          ? undefined
          : (bootOptions?.customLogger ?? {
              debug: jest.fn(),
              error: jest.fn(),
              fatal: jest.fn(),
              info: jest.fn(),
              trace: jest.fn(),
              warn: jest.fn(),
            }),
        loggerOptions: bootOptions?.loggerOptions,
      });

      teardown = async () => await app.teardown();
      return app;
    },
    setOptions(options: TestingBootstrapOptions) {
      bootOptions = deepExtend(bootOptions, options);
      return libraryTestRunner;
    },
    setup(service: ServiceFunction) {
      runFirst.add(service);
      return libraryTestRunner;
    },
    async teardown() {
      if (teardown) {
        await teardown();
        teardown = undefined;
      }
    },
    type: "test",
  };
  return libraryTestRunner;
}
