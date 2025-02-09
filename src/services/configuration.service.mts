import {
  AbstractConfig,
  ApplicationDefinition,
  BootstrapException,
  CodeConfigDefinition,
  ConfigLoader,
  ConfigLoaderEnvironment,
  configLoaderFile,
  DataTypes,
  deepExtend,
  DigitalAlchemyConfiguration,
  eachSeries,
  ILogger,
  KnownConfigs,
  OnConfigUpdateCallback,
  OptionalModuleConfiguration,
  PartialConfiguration,
  ServiceMap,
  TInjectedConfig,
  TServiceParams,
  TSetConfig,
} from "../index.mts";

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
}: TServiceParams): DigitalAlchemyConfiguration {
  const { is } = internal.utils;

  // modern problems require modern solutions
  let logger: ILogger;
  lifecycle.onPreInit(() => (logger = internal.boilerplate.logger.context(context)));
  const configDefinitions: KnownConfigs = new Map();
  const configuration: PartialConfiguration = {};
  const loaded = new Set<string>();
  const loaders = new Map<DataTypes, ConfigLoader>([]);

  // #MARK:
  const proxyData = {} as Record<string, object>;
  const configValueProxy = new Proxy(proxyData as TInjectedConfig, {
    get(_, project: keyof TInjectedConfig) {
      return { ...internal.utils.object.get(configuration, project) };
    },
    has(_, key: keyof TInjectedConfig) {
      Object.keys(configuration).forEach(key => (proxyData[key as keyof typeof proxyData] ??= {}));
      return Object.keys(configuration).includes(key);
    },
    ownKeys() {
      Object.keys(configuration).forEach(key => (proxyData[key as keyof typeof proxyData] ??= {}));
      return Object.keys(configuration);
    },
    set() {
      return false;
    },
  });

  // #MARK: setConfig
  function setConfig<
    Project extends keyof TInjectedConfig,
    Property extends keyof TInjectedConfig[Project],
  >(project: Project, property: Property, value: TInjectedConfig[Project][Property]): void {
    internal.utils.object.set(configuration, [project, property].join("."), value);
    // in case anyone needs a hook
    event.emit(EVENT_CONFIGURATION_UPDATED, project, property);
  }

  // #MARK: validateConfig
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

  // #MARK: registerLoader
  function registerLoader(loader: ConfigLoader, name: DataTypes) {
    loaders.set(name, loader);
  }

  // #MARK: mergeConfig
  function mergeConfig(data: Partial<AbstractConfig>, type: DataTypes[]) {
    // * prevents loaders from setting properties that they aren't supposed to
    configDefinitions.forEach((project, name) => {
      const keys = Object.keys(project) as (keyof typeof project)[];
      keys.forEach(key => {
        const { source } = project[key];
        if (is.array(source) && !type.some(i => source.includes(i))) {
          return;
        }
        const moduleConfig = data[name as keyof AbstractConfig];
        if (moduleConfig && key in moduleConfig) {
          internal.utils.object.set(
            configuration,
            [name, key].join("."),
            data[name as keyof AbstractConfig][key],
          );
        }
      });
    });
  }

  // #MARK: initialize
  async function initialize<S extends ServiceMap, C extends OptionalModuleConfiguration>(
    application: ApplicationDefinition<S, C>,
  ): Promise<string> {
    const start = performance.now();

    mergeConfig(
      await ConfigLoaderEnvironment({
        application,
        configs: configDefinitions,
        internal,
        logger,
      }),
      ["env", "argv"],
    );
    const canFile = internal.boot.options?.configSources?.file ?? true;
    if (canFile) {
      mergeConfig(
        await configLoaderFile({
          application,
          configs: configDefinitions,
          internal,
          logger,
        }),
        ["file"],
      );
    }
    // * load!
    await eachSeries([...loaders.entries()], async ([type, loader]) => {
      mergeConfig(await loader({ application, configs: configDefinitions, internal, logger }), [
        type,
      ]);
    });

    validateConfig();

    return `${(performance.now() - start).toFixed(DECIMALS)}ms`;
  }

  // #MARK: merge
  function merge(merge: Partial<PartialConfiguration>) {
    return deepExtend(configuration, merge);
  }

  // #MARK: loadProject
  function loadProject(library: string, definitions: CodeConfigDefinition) {
    if (loaded.has(library)) {
      return;
    }
    loaded.add(library);
    internal.utils.object.set(configuration, library, {});
    Object.keys(definitions).forEach(key => {
      internal.utils.object.set(configuration, [library, key].join("."), definitions[key].default);
    });
    configDefinitions.set(library, definitions);
    const bootConfig = internal.boot.options?.configuration ?? {};
    if (library in bootConfig) {
      const project = library as keyof typeof bootConfig;
      const config = bootConfig[project];
      Object.keys(config).forEach(key => {
        internal.utils.object.set(
          configuration,
          [project, key].join("."),
          config[key as keyof typeof config],
        );
      });
    }
  }

  // #MARK: onUpdate
  function onUpdate<
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
  }

  // #MARK: <return>
  return {
    /**
     * @internal
     */
    [INITIALIZE]: initialize,
    /**
     * @internal
     */
    [INJECTED_DEFINITIONS]: configValueProxy,
    /**
     * @internal
     */
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
    merge,

    onUpdate,

    registerLoader,

    set: setConfig as TSetConfig,
  };
}
