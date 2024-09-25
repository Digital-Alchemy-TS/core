import {
  ApplicationDefinition,
  BootstrapException,
  CodeConfigDefinition,
  ConfigLoader,
  ConfigLoaderEnvironment,
  ConfigLoaderFile,
  deepExtend,
  DigitalAlchemyConfiguration,
  eachSeries,
  KnownConfigs,
  OnConfigUpdateCallback,
  OptionalModuleConfiguration,
  PartialConfiguration,
  ServiceMap,
  TInjectedConfig,
  TServiceParams,
  TSetConfig,
} from "..";
import { is } from ".";

export const INITIALIZE = Symbol.for("initialize");
export const LOAD_PROJECT = Symbol.for("load-project");
export const EVENT_CONFIGURATION_UPDATED = "event_configuration_updated";
export const INJECTED_DEFINITIONS = Symbol.for("injected-config");
export type ConfigManager = ReturnType<typeof Configuration>;

const DECIMALS = 2;

export function Configuration({
  context,
  event,
  lifecycle,
  internal,
  // ! THIS DOES NOT EXIST BEFORE PRE INIT
  logger,
}: TServiceParams): DigitalAlchemyConfiguration {
  // modern problems require modern solutions
  lifecycle.onPreInit(() => (logger = internal.boilerplate.logger.context(context)));

  const configuration: PartialConfiguration = {};
  const configDefinitions: KnownConfigs = new Map();

  function injectedDefinitions(): TInjectedConfig {
    const out = {} as Record<string, object>;
    return new Proxy(out as TInjectedConfig, {
      get(_, project: keyof TInjectedConfig) {
        return internal.utils.object.get(configuration, project) ?? {};
      },
      has(_, key: keyof TInjectedConfig) {
        Object.keys(configuration).forEach(key => (out[key as keyof typeof out] ??= {}));
        return Object.keys(configuration).includes(key);
      },
      ownKeys() {
        Object.keys(configuration).forEach(key => (out[key as keyof typeof out] ??= {}));
        return Object.keys(configuration);
      },
      set() {
        return false;
      },
    });
  }

  function setConfig<
    Project extends keyof TInjectedConfig,
    Property extends keyof TInjectedConfig[Project],
  >(project: Project, property: Property, value: TInjectedConfig[Project][Property]): void {
    internal.utils.object.set(configuration, [project, property].join("."), value);
    // in case anyone needs a hook
    event.emit(EVENT_CONFIGURATION_UPDATED, project, property);
  }

  function validateConfig() {
    // * validate
    // - ensure all required properties have been defined
    configDefinitions.forEach((definitions, project) => {
      Object.keys(definitions).forEach(key => {
        const config = [project, key].join(".");
        if (
          definitions[key].required &&
          is.undefined(internal.utils.object.get(configuration, config))
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
  }

  // #MARK: Initialize
  async function initialize<S extends ServiceMap, C extends OptionalModuleConfiguration>(
    application: ApplicationDefinition<S, C>,
  ): Promise<string> {
    const configLoaders =
      internal.boot.application.configurationLoaders ??
      ([ConfigLoaderEnvironment, ConfigLoaderFile] as ConfigLoader[]);

    const start = performance.now();

    // * were configs disabled?
    if (is.empty(configLoaders)) {
      validateConfig();
      if (!configuration.boilerplate.IS_TEST) {
        logger.warn({ name: initialize }, `no config loaders defined`);
      }
      return `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    }

    // * load!
    await eachSeries(configLoaders, async loader => {
      const merge = await loader({
        application,
        configs: configDefinitions,
        internal,
        logger,
      });
      deepExtend(configuration, merge);
    });

    validateConfig();

    return `${(performance.now() - start).toFixed(DECIMALS)}ms`;
  }

  function merge(merge: Partial<PartialConfiguration>) {
    return deepExtend(configuration, merge);
  }

  function loadProject(library: string, definitions: CodeConfigDefinition) {
    internal.utils.object.set(configuration, library, {});
    Object.keys(definitions).forEach(key => {
      internal.utils.object.set(configuration, [library, key].join("."), definitions[key].default);
    });
    return configDefinitions.set(library, definitions);
  }

  return {
    [INITIALIZE]: initialize,
    [INJECTED_DEFINITIONS]: injectedDefinitions,
    [LOAD_PROJECT]: loadProject,

    /**
     * retrieve the metadata that was originally used to define the configs
     */
    getDefinitions: () => configDefinitions,

    /**
     * take a configuration object, and deep merge values
     *
     * intended for initial loading workflows
     */
    merge: merge,

    onUpdate<
      Project extends keyof TInjectedConfig,
      Property extends Extract<keyof TInjectedConfig[Project], string>,
    >(callback: OnConfigUpdateCallback<Project, Property>, project?: Project, property?: Property) {
      event.on(EVENT_CONFIGURATION_UPDATED, (updatedProject, updatedProperty) => {
        if (!is.empty(project) && project !== updatedProject) {
          return;
        }
        if (!is.empty(property) && property !== updatedProperty) {
          return;
        }
        callback(updatedProject, updatedProperty);
      });
    },

    set: setConfig as TSetConfig,
  };
}
