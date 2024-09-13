import { v4 } from "uuid";

import { CreateApplication, is } from "../../extensions";
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
  library?: LibraryDefinition<S, C>;

  /**
   * default: testing
   */
  name?: string;
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
};

type TestExtras = {
  module_config?: ModuleConfiguration;
};

export type TestingLibrary = {
  extras: (options: TestExtras) => TestingLibrary;
  configure: (options: TestingBootstrapOptions) => TestingLibrary;
  setup: (test: ServiceFunction) => TestingLibrary;
  run: (
    test: ServiceFunction,
  ) => Promise<ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>>;
  appendLibrary: (library: TLibrary) => TestingLibrary;
  appendService: (service: ServiceFunction, name?: string) => TestingLibrary;
  replaceLibrary: (name: string, library: TLibrary) => TestingLibrary;
  replaceService: (name: string, service: ServiceFunction) => TestingLibrary;
};

/**
 * library optional
 */
export function TestRunner<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>({ library, name }: CreateTestingLibraryOptions<S, C> = {}) {
  process.setMaxListeners(NONE);
  let bootOptions: TestingBootstrapOptions = {};
  let extra: TestExtras = {};
  const appendLibraries = new Map<string, TLibrary>();
  const appendServices = new Map<string, ServiceFunction>();
  const replaceLibrary = new Map<string, TLibrary>();
  const replaceService = new Map<string, ServiceFunction>();
  const runFirst = new Set<ServiceFunction>();

  const libraryTestRunner: TestingLibrary = {
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
      bootOptions = options;
      return libraryTestRunner;
    },
    extras(options) {
      extra = options;
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
      const testLibrary = library
        ? CreateLibrary({
            configuration: library.configuration,
            name: library.name,
            optionalDepends: library.optionalDepends,
            priorityInit: library.priorityInit,
            services: Object.fromEntries(
              Object.entries(library.services).map(([name, service]) => [
                name,
                replaceService.has(name) ? replaceService.get(name) : service,
              ]),
            ) as S,
          })
        : undefined;
      let LIB_RUN_FIRST: TLibrary;
      if (!is.empty(runFirst)) {
        LIB_RUN_FIRST = CreateLibrary({
          depends: testLibrary ? [testLibrary] : [],
          // @ts-expect-error for testing only
          name: v4(),
          services: Object.fromEntries(
            [...runFirst.values()].map(
              (service) =>
                [service.name || v4(), service] as [string, ServiceFunction],
            ),
          ) as ServiceMap,
        });
      }

      const customLoader = bootOptions?.configLoader
        ? [bootOptions?.configLoader]
        : [];
      const app = CreateApplication({
        configuration: extra?.module_config ?? {},
        configurationLoaders: bootOptions?.loadConfigs
          ? undefined
          : customLoader,
        libraries: [
          ...(is.empty(library?.depends)
            ? []
            : library.depends.map((i) =>
                replaceLibrary.has(i.name) ? replaceLibrary.get(i.name) : i,
              )),
          ...(testLibrary ? [testLibrary] : []),
        ],
        // @ts-expect-error it's life
        name: name ?? "testing",
        services: { test },
      });
      await app.bootstrap({
        appendLibrary: [
          ...appendLibraries.values(),
          ...(LIB_RUN_FIRST ? [LIB_RUN_FIRST] : []),
        ],
        appendService: Object.fromEntries(appendServices.entries()),
        bootLibrariesFirst: !!bootOptions?.bootLibrariesFirst,
        configuration: deepExtend(
          { boilerplate: { LOG_LEVEL: "info" } },
          bootOptions?.configuration,
        ),
        customLogger: bootOptions?.emitLogs
          ? undefined
          : {
              debug: jest.fn(),
              error: jest.fn(),
              fatal: jest.fn(),
              info: jest.fn(),
              trace: jest.fn(),
              warn: jest.fn(),
            },
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
