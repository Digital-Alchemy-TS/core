import {
  deepExtend,
  DOWN,
  eachSeries,
  is,
  LABEL,
  PAIR,
  SINGLE,
  TContext,
  UP,
  VALUE,
  ZCC,
} from "@zcc/utilities";
import { get, set } from "object-path";

import {
  AbstractConfig,
  AnyConfig,
  BaseConfig,
  BootstrapException,
  cast,
  CodeConfigDefinition,
  ConfigLoader,
  ConfigLoaderEnvironment,
  ConfigLoaderFile,
  initWiringConfig,
  KnownConfigs,
  OptionalModuleConfiguration,
  ServiceMap,
  ZCCApplicationDefinition,
} from "../helpers";

const ENVIRONMENT_LOAD_PRIORITY = 1;
const FILE_LOAD_PRIORITY = 2;

const APPLICATION = Symbol.for("APPLICATION_CONFIGURATION");

export function ZCC_Configuration() {
  const configLoaders = new Set<ConfigLoader>();
  let configuration: AbstractConfig = { application: {}, libs: {} };
  let configDefinitions: KnownConfigs = new Map();

  function defaultLoaders() {
    configLoaders.add([ConfigLoaderEnvironment, ENVIRONMENT_LOAD_PRIORITY]);
    configLoaders.add([ConfigLoaderFile, FILE_LOAD_PRIORITY]);
  }

  function getConfiguration(
    path: string | [string, string],
    dynamic: AnyConfig | undefined,
  ): BaseConfig {
    path = is.string(path) ? path : path.join(".");
    if (!is.string(path)) {
      // console.trace();
      return { type: "string" };
    }
    const parts = path.split(".");
    if (parts.length === SINGLE) {
      const configuration = configDefinitions.get(APPLICATION) || {};
      const config = configuration[path];
      if (!is.empty(config)) {
        return config;
      }
      if (dynamic) {
        return dynamic;
      }
      return {
        // Applications can yolo a bit harder than libraries
        default: undefined,
        type: "string",
      };
    }
    if (parts.length === PAIR) {
      const configuration = configDefinitions.get(parts[LABEL]) || {};
      const config = configuration[parts[VALUE]];
      if (!is.empty(config)) {
        return config;
      }
      if (dynamic) {
        return dynamic;
      }
      return {
        // Applications can yolo a bit harder than libraries
        default: undefined,
        type: "string",
      };
    }
    const [, library, property] = parts;
    const configuration = configDefinitions.get(library);
    if (!configuration) {
      return { type: "string" };
    }
    return configuration[property];
  }

  const out: ConfigManager = {
    addConfigLoader: (loader: ConfigLoader) => configLoaders.add(loader),
    addLibraryDefinition: (
      library: string,
      definitions: CodeConfigDefinition,
    ) => configDefinitions.set(library, definitions),
    configuration: () => configuration,
    defaultLoaders,
    get<T extends unknown = string>(
      path: string | [library: string, config: string],
      /**
       * Do not provide if it was provided with the module
       */
      dynamic?: AnyConfig,
    ): T {
      const config = getConfiguration(path, dynamic);
      path =
        is.string(path) ||
        [ZCC.application?.application, "application", "app"].includes(
          path[LABEL],
        )
          ? ["application", is.string(path) ? path : path[VALUE]].join(".")
          : ["libs", path[LABEL], path[VALUE]].join(".");
      const current = get(configuration, path);
      const defaultValue = config?.default;
      const value = current ?? defaultValue;

      return cast(value, config?.type ?? "string") as T;
    },
    getConfigDefinitions: () => configDefinitions,
    loadConfig: async <
      S extends ServiceMap,
      C extends OptionalModuleConfiguration,
    >(
      application: ZCCApplicationDefinition<S, C>,
    ) => {
      if (!application) {
        throw new BootstrapException(
          "configuration" as TContext,
          "NO_APPLICATION",
          "Cannot load configuration without having defined an application",
        );
      }
      initWiringConfig(configDefinitions, configuration);
      if (is.empty(configLoaders)) {
        // ZCC.systemLogger.debug(`No config loaders defined, adding default`);
        defaultLoaders();
      }
      await eachSeries(
        [...configLoaders.values()].sort(([, a], [, b]) => (a > b ? UP : DOWN)),
        async ([loader]) => {
          const merge = await loader(application, configDefinitions);
          deepExtend(configuration, merge);
        },
      );
    },
    merge: (merge: Partial<AbstractConfig>) => deepExtend(configuration, merge),
    set: (
      path: string | [project: string, property: string],
      value: unknown,
    ): void => {
      path = is.array(path)
        ? ["libs", path[LABEL], path[VALUE]].join(".")
        : ["application", path];
      set(configuration, path, value);
    },
    setApplicationDefinition: (definitions: CodeConfigDefinition) => {
      configDefinitions.set(APPLICATION, definitions);
    },
    testReset: () => {
      configuration = { application: {}, libs: {} };
      configDefinitions = new Map();
    },
  };
  ZCC.config = out;
  return out;
}

export type ConfigManager = {
  addConfigLoader: (loader: ConfigLoader) => Set<ConfigLoader>;
  addLibraryDefinition: (
    library: string,
    definitions: CodeConfigDefinition,
  ) => KnownConfigs;
  configuration: () => AbstractConfig;
  defaultLoaders: () => void;
  get<T extends unknown = string>(
    path: string | [library: string, config: string],
    dynamic?: AnyConfig,
  ): T;
  getConfigDefinitions: () => KnownConfigs;
  loadConfig: <S extends ServiceMap, C extends OptionalModuleConfiguration>(
    application: ZCCApplicationDefinition<S, C>,
  ) => Promise<void>;
  merge: (
    merge: Partial<AbstractConfig>,
  ) => AbstractConfig & Partial<AbstractConfig>;
  set: (
    path: string | [project: string, property: string],
    value: unknown,
  ) => void;
  setApplicationDefinition: (definitions: CodeConfigDefinition) => void;
  testReset: () => void;
};
declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    config: ConfigManager;
  }
}
