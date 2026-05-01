import type {
  AbstractConfig,
  ApplicationDefinition,
  CodeConfigDefinition,
  ConfigLoader,
  DataTypes,
  DigitalAlchemyConfiguration,
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
import {
  BootstrapException,
  ConfigLoaderEnvironment,
  configLoaderFile,
  deepExtend,
  eachSeries,
} from "../index.mts";

export const INITIALIZE = Symbol.for("initialize");
export const LOAD_PROJECT = Symbol.for("load-project");
export const EVENT_CONFIGURATION_UPDATED = "event_configuration_updated";
export const INJECTED_DEFINITIONS = Symbol.for("injected-config");
export type ConfigManager = ReturnType<typeof Configuration>;

const DECIMALS = 2;

/**
 * Central configuration state manager for the entire application.
 *
 * @remarks
 * Owns two things: the `configuration` plain-object store (all live config
 * values keyed by `module.key`) and the `configDefinitions` map (the schema
 * metadata declared by each library/application via `CreateLibrary`).
 *
 * Exposed to other services through the `config` proxy injected into every
 * `TServiceParams`. The proxy makes `config.boilerplate.LOG_LEVEL` feel like
 * a plain property read but actually calls `object.get(configuration, path)`
 * on each access so reads always reflect the current value.
 *
 * The initialization sequence (`INITIALIZE`) is called once during bootstrap,
 * between `PreInit` and `PostConfig`, and runs all registered config loaders
 * in priority order: env/argv first, then file (if enabled), then any
 * custom loaders registered via `registerLoader`.
 *
 * Config values can be updated at runtime via `setConfig` or `merge`; any
 * update emits `EVENT_CONFIGURATION_UPDATED` so downstream code (e.g. the
 * logger's level filter) can react via `onUpdate` subscriptions.
 */
export function Configuration({
  context,
  event,
  lifecycle,
  internal,
}: TServiceParams): DigitalAlchemyConfiguration {
  const { is } = internal.utils;

  // logger is not yet available at construction time (chicken-and-egg with
  // boilerplate wiring order), so we grab it on the first lifecycle hook
  let logger: ILogger;
  lifecycle.onPreInit(() => (logger = internal.boilerplate.logger.context(context)));
  const configDefinitions: KnownConfigs = new Map();
  const configuration: PartialConfiguration = {};
  const loaded = new Set<string>();
  const loaders = new Map<DataTypes, ConfigLoader>([]);

  // #MARK: configValueProxy
  // proxyData exists only to satisfy Proxy's ownKeys/has contract which requires
  // the target object to have enumerable keys for spread operations to work;
  // actual reads are always routed through object.get(configuration, path)
  const proxyData = {} as Record<string, object>;
  const configValueProxy = new Proxy(proxyData as TInjectedConfig, {
    get(_, project: keyof TInjectedConfig) {
      // always read live from configuration so callers see post-load values
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
      // configuration is read-only via the proxy; use setConfig() to mutate
      return false;
    },
  });

  // #MARK: setConfig
  /**
   * Set a single config property and emit an update event.
   *
   * @remarks
   * Writes directly into the live `configuration` store and fires
   * `EVENT_CONFIGURATION_UPDATED` so any `onUpdate` listeners react
   * immediately. Prefer `merge` for bulk updates.
   */
  function setConfig<
    Project extends keyof TInjectedConfig,
    Property extends keyof TInjectedConfig[Project],
  >(project: Project, property: Property, value: TInjectedConfig[Project][Property]): void {
    // logger may not be available if called during early wiring (before onPreInit)
    logger?.trace({ name: setConfig, property: String(property), project }, "setting config");
    internal.utils.object.set(configuration, [project, property].join("."), value);
    // notify any onUpdate listeners so they can react to the changed value
    event.emit(EVENT_CONFIGURATION_UPDATED, project, property);
    logger?.debug({ name: setConfig, property: String(property), project }, "config set");
  }

  // #MARK: validateConfig
  /**
   * Assert that every `required: true` config property has been given a value.
   *
   * @throws {BootstrapException} `REQUIRED_CONFIGURATION_MISSING` if any
   *   required property is still `undefined` after all loaders have run.
   */
  function validateConfig() {
    configDefinitions.forEach((definitions, project) => {
      Object.keys(definitions).forEach(key => {
        const config = [project, key].join(".");
        if (
          definitions[key].required &&
          is.undefined(internal.utils.object.get(configuration, config))
        ) {
          // required property was never populated by any loader or bootstrap config;
          // treat as a fatal wiring error so the app does not silently start broken
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
  /**
   * Register a custom config loader for a given `DataTypes` key.
   *
   * @remarks
   * Loaders run during `initialize`, after the built-in env/file loaders,
   * in the order they were registered. Only one loader per `DataTypes` key
   * is retained — registering twice replaces the first.
   */
  function registerLoader(loader: ConfigLoader, name: DataTypes) {
    // logger may not be available if called during early wiring (before onPreInit)
    logger?.trace({ name: registerLoader, type: name }, "registering config loader");
    loaders.set(name, loader);
  }

  // #MARK: mergeConfig
  /**
   * Merge raw loader output into the live config store, respecting source restrictions.
   *
   * @remarks
   * Each config property can declare a `source` allow-list (e.g. `["argv"]`).
   * Properties whose source list does not include any of the `type` values
   * passed here are silently skipped, preventing e.g. a file loader from
   * overwriting an argv-only value.
   */
  function mergeConfig(data: Partial<AbstractConfig>, type: DataTypes[]) {
    // skip properties whose declared source list excludes every type in this batch
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
  /**
   * Run all config loaders and validate required properties.
   *
   * @remarks
   * Called exactly once by `wiring.service.mts` between `PreInit` and
   * `PostConfig`. Order: env/argv → file (if `configSources.file` is truthy)
   * → any custom loaders registered via `registerLoader`. Returns a formatted
   * duration string that is included in bootstrap timing stats.
   *
   * @internal
   */
  async function initialize<S extends ServiceMap, C extends OptionalModuleConfiguration>(
    application: ApplicationDefinition<S, C>,
  ): Promise<string> {
    const start = performance.now();
    const configTimings: Record<string, string> = {};
    logger.trace({ name: initialize }, "loading configuration");

    // ConfigLoaderEnvironment handles both env and argv and tracks timings internally
    mergeConfig(
      await ConfigLoaderEnvironment({
        application,
        configs: configDefinitions,
        internal,
        logger,
        timings: configTimings,
      }),
      ["env", "argv"],
    );

    const canFile = internal.boot.options?.configSources?.file ?? false;
    // file loading is opt-in; default-off avoids unexpected file reads in tests
    if (canFile) {
      logger.trace({ name: initialize }, "loading file config");
      const fileStart = performance.now();
      mergeConfig(
        await configLoaderFile({
          application,
          configs: configDefinitions,
          internal,
          logger,
        }),
        ["file"],
      );
      configTimings.file = `${(performance.now() - fileStart).toFixed(DECIMALS)}ms`;
    }
    // run any additional loaders registered by library code
    const configSources = internal.boot.options.configSources ?? {};
    await eachSeries([...loaders.entries()], async ([type, loader]) => {
      // configSources[type] === false is an explicit opt-out; absence defaults to enabled
      if (configSources[type] === false) {
        logger.trace({ name: initialize, type }, "loader disabled via configSources, skipping");
        return;
      }
      logger.trace({ name: initialize, type }, "running loader");
      const loaderStart = performance.now();
      mergeConfig(await loader({ application, configs: configDefinitions, internal, logger }), [
        type,
      ]);
      configTimings[type] = `${(performance.now() - loaderStart).toFixed(DECIMALS)}ms`;
    });

    validateConfig();

    internal.boot.configTimings = configTimings;

    const total = `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    logger.debug({ name: initialize, timings: configTimings, total }, "configuration loaded");
    return total;
  }

  // #MARK: merge
  /**
   * Deep-merge a partial configuration object into the live store.
   *
   * @remarks
   * Does not emit `EVENT_CONFIGURATION_UPDATED`; intended for bulk
   * pre-boot merges (e.g. bootstrap `options.configuration`).
   * Use `setConfig` for individual runtime updates that need listeners notified.
   */
  function merge(merge: Partial<PartialConfiguration>) {
    return deepExtend(configuration, merge);
  }

  // #MARK: loadProject
  /**
   * Register a module's config schema and populate default values.
   *
   * @remarks
   * Called once per library/application during wiring. Idempotent — a second
   * call for the same library name is silently ignored to prevent re-initialisation
   * during test re-runs. After registering defaults, any values already present
   * in `options.configuration` for this project are applied immediately so they
   * take effect before any loader runs.
   *
   * @internal
   */
  function loadProject(library: string, definitions: CodeConfigDefinition) {
    // guard against double-registration (e.g. test re-runs, appendLibrary replacing)
    if (loaded.has(library)) {
      return;
    }
    loaded.add(library);
    internal.utils.object.set(configuration, library, {});
    Object.keys(definitions).forEach(key => {
      internal.utils.object.set(configuration, [library, key].join("."), definitions[key].default);
    });
    configDefinitions.set(library, definitions);
    // apply any values that were baked into bootstrap options for this project;
    // these take priority over schema defaults but lose to loader-sourced values
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
  /**
   * Subscribe to configuration change events.
   *
   * @remarks
   * When `project` and/or `property` are provided the callback is only
   * invoked for changes to that specific path. Omitting both subscribes to
   * all configuration changes. The callback receives `(project, property)`
   * matching the changed key.
   */
  function onUpdate<
    Project extends keyof TInjectedConfig,
    Property extends Extract<keyof TInjectedConfig[Project], string>,
  >(callback: OnConfigUpdateCallback<Project, Property>, project?: Project, property?: Property) {
    event.on(EVENT_CONFIGURATION_UPDATED, (updatedProject, updatedProperty) => {
      // filter to the specific project/property if the caller narrowed the subscription
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
     * Retrieve the metadata that was originally used to define the configs.
     */
    getDefinitions: () => configDefinitions,

    /**
     * Deep-merge a partial configuration object into the live store.
     *
     * @remarks
     * Intended for initial loading workflows. Does not fire `EVENT_CONFIGURATION_UPDATED`.
     */
    merge,

    /**
     * Subscribe to configuration change events.
     *
     * @remarks
     * Narrow to a specific project and/or property, or omit both to receive all updates.
     */
    onUpdate,

    /**
     * Register a custom config loader for a given `DataTypes` key.
     */
    registerLoader,

    /**
     * Set a single config property and notify all `onUpdate` subscribers.
     */
    set: setConfig as TSetConfig,
  };
}
