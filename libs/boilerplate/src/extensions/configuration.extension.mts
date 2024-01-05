import {
  deepExtend,
  DOWN,
  eachSeries,
  is,
  LABEL,
  PAIR,
  SINGLE,
  UP,
  VALUE,
  ZCC,
} from "@zcc/utilities";
import { get, set } from "object-path";

import {
  AbstractConfig,
  AnyConfig,
  BaseConfig,
  CodeConfigDefinition,
  ConfigLoaderReturn,
  KnownConfigs,
} from "../helpers/config.helper.mjs";
import { ConfigLoaderEnvironment } from "../helpers/config-environment-loader.helper.mjs";
import { ConfigLoaderFile } from "../helpers/config-file-loader.helper.mjs";
import { BootstrapException } from "../helpers/errors.helper.mjs";

const ENVIRONMENT_LOAD_PRIORITY = 1;
const FILE_LOAD_PRIORITY = 2;

const APPLICATION = Symbol.for("APPLICATION_CONFIGURATION");

type ConfigLoader = [
  loader: (definedConfigurations: KnownConfigs) => ConfigLoaderReturn,
  priority: number,
];

function cast<T = unknown>(data: string | string[], type: string): T {
  switch (type) {
    case "boolean": {
      data ??= "";
      return (
        is.boolean(data)
          ? data
          : ["true", "y", "1"].includes((data as string).toLowerCase())
      ) as T;
    }
    case "number":
      return Number(data) as T;
    case "string[]":
      if (is.undefined(data)) {
        return [] as T;
      }
      if (is.array(data)) {
        return data.map(String) as T;
      }
      // This occurs with cli switches
      // If only 1 is passed, it'll get the value
      // ex: --foo=bar  ==== {foo:'bar'}
      // If duplicates are passed, will receive array
      // ex: --foo=bar --foo=baz === {foo:['bar','baz']}
      return [String(data)] as T;
  }
  return data as T;
}

function initWiringConfig(
  configs: KnownConfigs,
  configuration: Partial<AbstractConfig>,
): void {
  configs.forEach((configurations, project) => {
    const isApplication = !is.string(project);
    Object.entries(configurations).forEach(([key, config]) => {
      if (config.default !== undefined) {
        const configPath = isApplication
          ? `application.${key}`
          : `libs.${project}.${key}`;
        set(configuration, configPath, config.default);
      }
    });
  });
}
export type ModuleConfiguration = Record<string, AnyConfig>;
export type OptionalModuleConfiguration = ModuleConfiguration | undefined;

export function CreateConfiguration() {
  const configLoaders = new Set<ConfigLoader>();
  let configuration: AbstractConfig = { application: {}, libs: {} };
  let configDefinitions: KnownConfigs = new Map();
  const logger = ZCC.logger.context("configuration.extension");

  function defaultLoaders() {
    configLoaders.add([ConfigLoaderEnvironment, ENVIRONMENT_LOAD_PRIORITY]);
    configLoaders.add([ConfigLoaderFile, FILE_LOAD_PRIORITY]);
  }

  function getConfiguration(
    path: string | [string, string],
    dynamic: AnyConfig | undefined,
  ): BaseConfig {
    path = is.array(path) ? path.join(".") : path;
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

  return {
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
        [ZCC.application?.name, "application", "app"].includes(path[LABEL])
          ? ["application", is.string(path) ? path : path[VALUE]].join(".")
          : ["libs", path[LABEL], path[VALUE]].join(".");
      const current = get(configuration, path);
      const defaultValue = config?.default;
      const value = current ?? defaultValue;

      return cast(value, config?.type ?? "string") as T;
    },
    getConfigDefinitions: () => configDefinitions,
    loadConfig: async () => {
      if (!ZCC.application) {
        throw new BootstrapException(
          "configuration",
          "NO_APPLICATION",
          "Cannot load configuration without having defined an application",
        );
      }
      initWiringConfig(configDefinitions, configuration);
      if (is.empty(configLoaders)) {
        ZCC.systemLogger.debug(`No config loaders defined, adding default`);
        defaultLoaders();
      }
      await eachSeries(
        [...configLoaders.values()].sort(([, a], [, b]) => (a > b ? UP : DOWN)),
        async ([loader]) => {
          const merge = await loader(configDefinitions);
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
}

export type ConfigManager = ReturnType<typeof CreateConfiguration>;
