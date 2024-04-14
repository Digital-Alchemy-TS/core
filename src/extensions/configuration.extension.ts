import {
  ApplicationDefinition,
  BootstrapException,
  CodeConfigDefinition,
  ConfigLoader,
  ConfigLoaderEnvironment,
  ConfigLoaderFile,
  deepExtend,
  eachSeries,
  KnownConfigs,
  OptionalModuleConfiguration,
  PartialConfiguration,
  ServiceMap,
  TBlackHole,
  TInjectedConfig,
  TServiceParams,
} from "..";
import { is } from ".";

export const INITIALIZE = Symbol.for("initialize");
export const LOAD_PROJECT = Symbol.for("load-project");
export const EVENT_CONFIGURATION_UPDATED = "event_configuration_updated";
export const INJECTED_DEFINITIONS = Symbol.for("injected-config");
export type ConfigManager = ReturnType<typeof Configuration>;

export function Configuration({
  context,
  event,
  lifecycle,
  internal,
  // ! THIS DOES NOT EXIST BEFORE PRE INIT
  logger,
}: TServiceParams) {
  // 🙊 but that's illegal!
  lifecycle.onPreInit(
    () => (logger = internal.boilerplate.logger.context(context)),
  );

  const configuration: PartialConfiguration = {};
  const configDefinitions: KnownConfigs = new Map();

  type OnConfigUpdateCallback<
    Project extends keyof TInjectedConfig,
    Property extends keyof TInjectedConfig[Project],
  > = (project: Project, property: Property) => TBlackHole;

  //#region Methods
  function InjectedDefinitions() {
    return new Proxy({} as TInjectedConfig, {
      get(_, project: keyof TInjectedConfig) {
        return internal.utils.object.get(configuration, project) ?? {};
      },
      getOwnPropertyDescriptor(_, project: string) {
        return {
          configurable: false,
          enumerable: true,
          value: internal.utils.object.get(configuration, project) ?? {},
          writable: false,
        };
      },
      ownKeys() {
        return Object.keys(configuration);
      },
    });
  }

  function SetConfig<
    Project extends keyof TInjectedConfig,
    Property extends keyof TInjectedConfig[Project],
  >(
    project: Project,
    property: Property,
    value: TInjectedConfig[Project][Property],
  ): void {
    internal.utils.object.set(
      configuration,
      [project, property].join("."),
      value,
    );
    // in case anyone needs a hook
    event.emit(EVENT_CONFIGURATION_UPDATED, project, property);
  }

  // #MARK: Initialize
  async function Initialize<
    S extends ServiceMap,
    C extends OptionalModuleConfiguration,
  >(application: ApplicationDefinition<S, C>): Promise<string | never> {
    const configLoaders =
      internal.boot.application.configurationLoaders ??
      ([ConfigLoaderEnvironment, ConfigLoaderFile] as ConfigLoader[]);

    const start = Date.now();
    // * sanity check
    if (!application) {
      throw new BootstrapException(
        context,
        "NO_APPLICATION",
        "Cannot load configuration without having defined an application",
      );
    }

    // * were configs disabled?
    if (is.empty(configLoaders)) {
      logger.warn({ name: Initialize }, `no config loaders defined`);
      return `${Date.now() - start}ms`;
    }

    // * load!
    await eachSeries(configLoaders, async (loader) => {
      const merge = await loader({
        application,
        configs: configDefinitions,
        internal,
        logger,
      });
      deepExtend(configuration, merge);
    });

    // * validate
    // - ensure all required properties have been defined
    configDefinitions.forEach((definitions, project) => {
      Object.keys(definitions).forEach((key) => {
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
    return `${Date.now() - start}ms`;
  }

  function Merge(merge: Partial<PartialConfiguration>) {
    return deepExtend(configuration, merge);
  }

  function LoadProject(library: string, definitions: CodeConfigDefinition) {
    internal.utils.object.set(configuration, library, {});
    Object.keys(definitions).forEach((key) => {
      internal.utils.object.set(
        configuration,
        [library, key].join("."),
        definitions[key].default,
      );
    });
    return configDefinitions.set(library, definitions);
  }
  // #endregion

  // #region Return object
  return {
    [INITIALIZE]: Initialize,
    [INJECTED_DEFINITIONS]: InjectedDefinitions,
    [LOAD_PROJECT]: LoadProject,

    /**
     * retrieve the metadata that was originally used to define the configs
     */
    getDefinitions: () => configDefinitions,

    /**
     * take a configuration object, and deep merge values
     *
     * intended for initial loading workflows
     */
    merge: Merge,

    /**
     * Not a replacement for `onPostConfig`
     *
     * Only receives updates from `config.set` calls
     */
    onUpdate<
      Project extends keyof TInjectedConfig,
      Property extends Extract<keyof TInjectedConfig[Project], string>,
    >(
      callback: OnConfigUpdateCallback<Project, Property>,
      project?: Project,
      property?: Property,
    ) {
      event.on(
        EVENT_CONFIGURATION_UPDATED,
        (updatedProject, updatedProperty) => {
          if (!is.empty(project) && project !== updatedProject) {
            return;
          }
          if (!is.empty(property) && property !== updatedProperty) {
            return;
          }
          callback(updatedProject, updatedProperty);
        },
      );
    },

    /**
     * type friendly method of updating a single configuration
     *
     * emits update event
     */
    set: SetConfig as TSetConfig,
  };
  // #endregion
}

export type TSetConfig = <
  Project extends keyof TInjectedConfig,
  Property extends keyof TInjectedConfig[Project],
>(
  project: Project,
  property: Property,
  value: TInjectedConfig[Project][Property],
) => void;
