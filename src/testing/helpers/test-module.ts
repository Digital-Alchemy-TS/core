import { v4 } from "uuid";

import { CreateApplication, ILogger, is } from "../../extensions";
import {
  ApplicationDefinition,
  ConfigLoader,
  CreateLibrary,
  deepExtend,
  LibraryDefinition,
  LoggerOptions,
  ModuleConfiguration,
  NONE,
  OptionalModuleConfiguration,
  PartialConfiguration,
  ServiceFunction,
  ServiceMap,
  TLibrary,
} from "../../helpers";

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
   * pass through to bootstrap params
   */
  loggerOptions?: LoggerOptions;

  /**
   * matches regular bootstrap options
   */
  bootLibrariesFirst?: boolean;

  /**
   * default values to use for configurations, before user values come in
   */
  configuration?: PartialConfiguration;

  /**
   * manually call teardown before finishing the test
   */
  forceTeardown?: boolean;

  /**
   * define a configuration for the unit tests
   *
   * > **note**: you probably don't need to do this, it's not even documented
   */
  module_config?: ModuleConfiguration;
};

export type iTestRunner = {
  /**
   * chained calls deep merge options together
   */
  configure: (options: TestingBootstrapOptions) => iTestRunner;
  setup: (test: ServiceFunction) => iTestRunner;
  run: (
    test: ServiceFunction,
  ) => Promise<ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>>;
  appendLibrary: (library: TLibrary) => iTestRunner;
  appendService: (service: ServiceFunction, name?: string) => iTestRunner;
  replaceLibrary: (name: string, library: TLibrary) => iTestRunner;
  replaceService: (name: string, service: ServiceFunction) => iTestRunner;
  // pickService: () => iTestRunner;
  // omitService: () => iTestRunner;
};

/**
 * library optional
 */
export function TestRunner<S extends ServiceMap, C extends OptionalModuleConfiguration>(
  options: CreateTestingLibraryOptions<S, C> = {},
) {
  process.setMaxListeners(NONE);
  let bootOptions: TestingBootstrapOptions = {};
  const appendLibraries = new Map<string, TLibrary>();
  const appendServices = new Map<string, ServiceFunction>();
  const replaceLibrary = new Map<string, TLibrary>();
  const replaceService = new Map<string, ServiceFunction>();
  const runFirst = new Set<ServiceFunction>();

  function getLibraries(target: LibraryDefinition<S, C> | ApplicationDefinition<S, C>) {
    if ("depends" in target) {
      return target.depends;
    }
    return "libraries" in target ? target.libraries : [];
  }

  function buildApp(
    name: string,
    target: LibraryDefinition<S, C> | ApplicationDefinition<S, C>,
    test: ServiceFunction,
  ) {
    const optional = "optionalDepends" in target ? target.optionalDepends : [];
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

  const libraryTestRunner: iTestRunner = {
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
    configure(options: TestingBootstrapOptions) {
      bootOptions = deepExtend(bootOptions, options);
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

      if (bootOptions?.forceTeardown) {
        await app.teardown();
      }

      return app;
    },
    setup(service: ServiceFunction) {
      runFirst.add(service);
      return libraryTestRunner;
    },
  };
  return libraryTestRunner;
}
