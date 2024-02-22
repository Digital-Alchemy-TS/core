import { deepExtend, DOWN, eachSeries, is, UP, ZCC } from "../..";
import {
  ApplicationDefinition,
  BootstrapException,
  CodeConfigDefinition,
  ConfigLoader,
  ConfigLoaderEnvironment,
  ConfigLoaderFile,
  ConfigLoaderMethod,
  KnownConfigs,
  OptionalModuleConfiguration,
  PartialConfiguration,
  ServiceMap,
  TInjectedConfig,
  TServiceParams,
} from "../helpers";

// # Symbols
export const INITIALIZE = Symbol.for("initialize");
export const LOAD_PROJECT = Symbol.for("load-project");
export const EVENT_CONFIGURATION_UPDATED = "event_configuration_updated";
export const INJECTED_DEFINITIONS = Symbol.for("injected-config");

export function Configuration({
  context,
  event,
  lifecycle,
  // ! THIS DOES NOT EXIST BEFORE PRE INIT
  logger,
}: TServiceParams) {
  // 🙊 but that's illegal!
  lifecycle.onPreInit(() => (logger = ZCC.logger.context(context)));

  // # Locals
  const configLoaders = new Set<ConfigLoader>();
  const configuration: PartialConfiguration = {};
  const configDefinitions: KnownConfigs = new Map();
  const DEFAULT_LOADERS = [
    ConfigLoaderEnvironment,
    ConfigLoaderFile,
  ] as ConfigLoaderMethod[];

  // # Methods
  // ## Load the config for an app
  async function Initialize<
    S extends ServiceMap,
    C extends OptionalModuleConfiguration,
  >(application: ApplicationDefinition<S, C>) {
    const start = Date.now();
    // * sanity check
    if (!application) {
      throw new BootstrapException(
        context,
        "NO_APPLICATION",
        "Cannot load configuration without having defined an application",
      );
    }

    // * if a new standalone loader hasn't been defined, use provided
    if (is.empty(configLoaders)) {
      logger.debug(`no config loaders defined, adding default`);
      DEFAULT_LOADERS.forEach((i, index) => configLoaders.add([i, index]));
    }

    // * load!
    await eachSeries(
      [...configLoaders.values()].sort(([, a], [, b]) => (a > b ? UP : DOWN)),
      async ([loader]) => {
        const merge = await loader({
          application,
          configs: configDefinitions,
        });
        deepExtend(configuration, merge);
      },
    );

    // * validate
    // - ensure all required properties have been defined
    configDefinitions.forEach((definitions, project) => {
      Object.keys(definitions).forEach(key => {
        const config = [project, key].join(".");
        if (
          definitions[key].required &&
          is.undefined(ZCC.utils.object.get(configuration, config))
        ) {
          // ruh roh
          throw new BootstrapException(
            context,
            "REQUIRED_CONFIGURATION_MISSING",
            `Configuration property ${config} is not defined`,
          );
        }
      });
    });
    return `${Date.now() - start}ms`;
  }

  // ## Value that gets injected into services
  function InjectedDefinitions() {
    return new Proxy({} as TInjectedConfig, {
      get(_, project: keyof TInjectedConfig) {
        return ZCC.utils.object.get(configuration, project) ?? {};
      },
    });
  }

  // ## Set a configuration value at runtime
  function SetConfig<
    Project extends keyof TInjectedConfig,
    Property extends keyof TInjectedConfig[Project],
  >(
    project: Project,
    property: Property,
    value: TInjectedConfig[Project][Property],
  ): void {
    ZCC.utils.object.set(configuration, [project, property].join("."), value);
    // in case anyone needs a hook
    event.emit(EVENT_CONFIGURATION_UPDATED);
  }

  // ## Provide new values for some config values
  function Merge(merge: Partial<PartialConfiguration>) {
    return deepExtend(configuration, merge);
  }

  // ## Add a library, and it's associated definitions
  function LoadProject(library: string, definitions: CodeConfigDefinition) {
    ZCC.utils.object.set(configuration, library, {});
    Object.keys(definitions).forEach(key => {
      ZCC.utils.object.set(
        configuration,
        [library, key].join("."),
        definitions[key].default,
      );
    });
    return configDefinitions.set(library, definitions);
  }

  // ## Return object
  const out: ConfigManager = {
    [INITIALIZE]: Initialize,
    [INJECTED_DEFINITIONS]: InjectedDefinitions,
    [LOAD_PROJECT]: LoadProject,
    addConfigLoader: (loader: ConfigLoader) => configLoaders.add(loader),
    merge: Merge,
    set: SetConfig,
  };
  ZCC.config = out;
  return out;
}

// # Type definitions
export type ConfigManager = {
  addConfigLoader: (loader: ConfigLoader) => Set<ConfigLoader>;
  [INJECTED_DEFINITIONS]: () => TInjectedConfig;
  [LOAD_PROJECT]: (
    library: keyof TInjectedConfig,
    definitions: CodeConfigDefinition,
  ) => KnownConfigs;
  [INITIALIZE]: <S extends ServiceMap, C extends OptionalModuleConfiguration>(
    application: ApplicationDefinition<S, C>,
  ) => Promise<string>;
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

// ? Using symbols to provide methods to the bootstrapping process
// The values don't have a use elsewhere, so they get excluded from the public interface
type ExcludeSymbolKeys<T> = {
  [Key in keyof T as Key extends symbol ? never : Key]: T[Key];
};

declare module "../../utilities" {
  export interface ZCCDefinition {
    config: ExcludeSymbolKeys<ConfigManager>;
  }
}
