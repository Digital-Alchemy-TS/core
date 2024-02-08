import { eachSeries } from "async";
import { get, set } from "object-path";

import { deepExtend, DOWN, is, TContext, UP, ZCC } from "../..";
import {
  BootstrapException,
  CodeConfigDefinition,
  ConfigLoader,
  ConfigLoaderEnvironment,
  ConfigLoaderFile,
  KnownConfigs,
  OptionalModuleConfiguration,
  PartialConfiguration,
  ServiceMap,
  TInjectedConfig,
  ZCCApplicationDefinition,
} from "../helpers";

const ENVIRONMENT_LOAD_PRIORITY = 1;
const FILE_LOAD_PRIORITY = 2;
export const INITIALIZE = Symbol.for("initialize");
export const LOAD_PROJECT = Symbol.for("load-project");
export const INJECTED_DEFINITIONS = Symbol.for("injected-config");

export function ZCC_Configuration() {
  const configLoaders = new Set<ConfigLoader>();
  const configuration: PartialConfiguration = {};
  const configDefinitions: KnownConfigs = new Map();

  function defaultLoaders() {
    configLoaders.add([ConfigLoaderEnvironment, ENVIRONMENT_LOAD_PRIORITY]);
    configLoaders.add([ConfigLoaderFile, FILE_LOAD_PRIORITY]);
  }

  const out: ConfigManager = {
    [INITIALIZE]: async <
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
      if (is.empty(configLoaders)) {
        ZCC.systemLogger.debug(`No config loaders defined, adding default`);
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
    [INJECTED_DEFINITIONS]: () =>
      // this ended up being the most sane way to fulfill
      new Proxy({} as TInjectedConfig, {
        get(_, project: keyof TInjectedConfig) {
          return get(configuration, project) ?? {};
        },
      }),
    [LOAD_PROJECT]: (library: string, definitions: CodeConfigDefinition) => {
      set(configuration, library, {});
      Object.keys(definitions).forEach(key => {
        set(configuration, [library, key].join("."), definitions[key].default);
      });
      return configDefinitions.set(library, definitions);
    },
    addConfigLoader: (loader: ConfigLoader) => configLoaders.add(loader),
    merge: (merge: Partial<PartialConfiguration>) =>
      deepExtend(configuration, merge),
    set<
      Project extends keyof TInjectedConfig,
      Property extends keyof TInjectedConfig[Project],
    >(
      project: Project,
      property: Property,
      value: TInjectedConfig[Project][Property],
    ): void {
      set(configuration, [project, property].join("."), value);
    },
  };
  ZCC.config = out;
  return out;
}

export type ConfigManager = {
  addConfigLoader: (loader: ConfigLoader) => Set<ConfigLoader>;
  [INJECTED_DEFINITIONS]: () => TInjectedConfig;
  [LOAD_PROJECT]: (
    library: keyof TInjectedConfig,
    definitions: CodeConfigDefinition,
  ) => KnownConfigs;
  [INITIALIZE]: <S extends ServiceMap, C extends OptionalModuleConfiguration>(
    application: ZCCApplicationDefinition<S, C>,
  ) => Promise<void>;
  merge: (
    merge: Partial<PartialConfiguration>,
  ) => PartialConfiguration & Partial<PartialConfiguration>;
  set<
    Project extends keyof TInjectedConfig,
    Property extends keyof TInjectedConfig[Project],
  >(
    project: Project,
    property: Property,
    value: TInjectedConfig[Project][Property],
  ): void;
};

type ExcludeSymbolKeys<T> = {
  [Key in keyof T as Key extends symbol ? never : Key]: T[Key];
};

declare module "../../utilities" {
  export interface ZCCDefinition {
    config: ExcludeSymbolKeys<ConfigManager>;
  }
}
