import type { AbstractConfig } from "@digital-alchemy/symbols";

import type {
  ApplicationDefinition,
  CodeConfigDefinition,
  ConfigLoader,
  ConfigMetadataDescriptor,
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
  assertConfigEntry,
  BootstrapException,
  ConfigLoaderEnvironment,
  configLoaderFile,
  deepExtend,
  eachSeries,
  getDefaultMetadata,
  getSchemaMetadata,
  isSchemaConfig,
  processSchemaValue,
} from "../index.mts";

export const INITIALIZE = Symbol.for("initialize");
export const LOAD_PROJECT = Symbol.for("load-project");
export const MERGE_RAW = Symbol.for("merge-raw-configuration");
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
  type ConfigStore = Record<string, Record<string, unknown>>;
  const configDefinitions: KnownConfigs = new Map();
  const configuration = {} as PartialConfiguration;
  const rawConfiguration: ConfigStore = {};
  const stagedConfiguration: ConfigStore = {};
  const metadata: ConfigMetadataDescriptor[] = [];
  const loaded = new Set<string>();
  const loaders = new Map<DataTypes, ConfigLoader>([]);
  let finalized = false;

  function mergeStore(target: ConfigStore, incoming: unknown): ConfigStore {
    if (!is.object(incoming)) {
      return target;
    }
    Object.keys(incoming).forEach(project => {
      const incomingProject = (incoming as Record<string, unknown>)[project];
      if (!is.object(incomingProject)) {
        target[project] = incomingProject as Record<string, unknown>;
        return;
      }
      const targetProject = (target[project] ??= {});
      Object.keys(incomingProject).forEach(property => {
        const value = (incomingProject as Record<string, unknown>)[property];
        const definition = configDefinitions.get(project)?.[property];
        if (definition && isSchemaConfig(definition)) {
          // Schema values are atomic at their configuration-key boundary.
          targetProject[property] = value;
          return;
        }
        // Preserve the legacy deep-merge contract for non-schema definitions.
        deepExtend(targetProject, { [property]: value });
      });
    });
    return target;
  }

  function clearStagedValue(project: string, property: string): void {
    const stagedProject = stagedConfiguration[project];
    if (stagedProject) {
      delete stagedProject[property];
    }
  }

  /** Merge bootstrap input without routing encoded values through the public output API. */
  function mergeRawConfiguration(incoming: unknown): void {
    mergeStore(rawConfiguration, incoming);
    if (!is.object(incoming)) {
      return;
    }
    Object.keys(incoming).forEach(project => {
      const incomingProject = (incoming as Record<string, unknown>)[project];
      if (!is.object(incomingProject)) {
        return;
      }
      Object.keys(incomingProject).forEach(property => {
        clearStagedValue(project, property);
        const definition = configDefinitions.get(project)?.[property];
        if (definition && !isSchemaConfig(definition)) {
          const liveProject = ((configuration as unknown as ConfigStore)[project] ??= {});
          deepExtend(liveProject, {
            [property]: (incomingProject as Record<string, unknown>)[property],
          });
        }
      });
    });
  }

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
    if (!finalized) {
      internal.utils.object.set(stagedConfiguration, [project, property].join("."), value);
    }
    // notify any onUpdate listeners so they can react to the changed value
    event.emit(EVENT_CONFIGURATION_UPDATED, project, property);
    logger?.debug({ name: setConfig, property: String(property), project }, "config set");
  }

  // #MARK: finalizeConfig
  /**
   * Process every schema after all raw loaders have settled, then publish one
   * complete configuration snapshot to the injected proxy.
   *
   * @remarks
   * The separate raw store lets an invalid value from a losing source be
   * overwritten before schema processing. No partial processed snapshot is
   * published when a schema fails.
   *
   * @throws {BootstrapException} `REQUIRED_CONFIGURATION_MISSING` when a
   *   required legacy property is undefined after loading.
   * @throws {BootstrapException} `CONFIG_SCHEMA_REQUIRED` when a required
   *   schema output is undefined.
   * @throws {BootstrapException} `CONFIG_SCHEMA_INVALID` when schema validation
   *   rejects the settled value.
   * @throws {BootstrapException} `CONFIG_SCHEMA_PROCESSING_FAILED` when a
   *   provider throws or returns an unusable result.
   * @throws {BootstrapException} `CONFIG_SCHEMA_PEER_MISSING` or
   *   `CONFIG_SCHEMA_PEER_BROKEN` when TypeBox cannot be loaded.
   * @throws {BootstrapException} `CONFIG_SCHEMA_PROVIDER_UNSUPPORTED` when a
   *   Zod surface is unsupported, or `CONFIG_SCHEMA_AMBIGUOUS` when dispatch
   *   finds multiple providers.
   */
  async function finalizeConfig() {
    const next = {} as ConfigStore;
    await eachSeries([...configDefinitions.entries()], async ([project, definitions]) => {
      const output = (next[project] ??= {});
      await eachSeries(Object.keys(definitions), async property => {
        const definition = definitions[property];
        const raw = rawConfiguration[project]?.[property];
        const stagedProject = stagedConfiguration[project];
        const hasStaged = is.object(stagedProject) && Object.hasOwn(stagedProject, property);
        let value: unknown;
        if (hasStaged) {
          value = isSchemaConfig(definition)
            ? (stagedProject as Record<string, unknown>)[property]
            : (configuration as unknown as ConfigStore)[project]?.[property];
        } else if (isSchemaConfig(definition)) {
          value = await processSchemaValue(definition.schema, raw, false, {
            context,
            project,
            property,
          });
        } else {
          value = raw;
        }
        if (definition.required && is.undefined(value)) {
          throw new BootstrapException(
            context,
            isSchemaConfig(definition)
              ? "CONFIG_SCHEMA_REQUIRED"
              : "REQUIRED_CONFIGURATION_MISSING",
            isSchemaConfig(definition)
              ? `Configuration schema output is missing for ${project}.${property}`
              : `Configuration property ${project}.${property} is not defined`,
          );
        }
        output[property] = value;
      });
    });

    // Preserve the historical behavior for runtime callers that supplied an
    // unknown key through JavaScript, without letting it affect schema entries.
    Object.keys(rawConfiguration).forEach(project => {
      const rawProject = rawConfiguration[project];
      if (!is.object(rawProject)) {
        return;
      }
      const output = (next[project] ??= {});
      Object.keys(rawProject).forEach(property => {
        if (!(property in output)) {
          output[property] = rawProject[property];
        }
      });
    });

    // Public pre-finalization mutations are already output-shaped. Overlay them
    // after provider processing so transformed values are never decoded twice.
    Object.keys(stagedConfiguration).forEach(project => {
      const stagedProject = stagedConfiguration[project];
      if (!is.object(stagedProject)) {
        return;
      }
      const output = (next[project] ??= {});
      Object.keys(stagedProject).forEach(property => {
        if (!configDefinitions.get(project)?.[property]) {
          output[property] = stagedProject[property];
        }
      });
    });

    Object.keys(configuration).forEach(project => delete (configuration as ConfigStore)[project]);
    Object.assign(configuration, next);
    finalized = true;
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
      const keys = Object.keys(project);
      keys.forEach(key => {
        const { source } = project[key];
        if (is.array(source) && !type.some(i => source.includes(i))) {
          return;
        }
        const moduleConfig = (data as Record<string, unknown>)[name];
        if (is.object(moduleConfig) && key in moduleConfig) {
          const value = (moduleConfig as Record<string, unknown>)[key];
          const target = (rawConfiguration[name] ??= {});
          // Loader output remains raw, including schema values that may be
          // invalid until source precedence has completely settled.
          target[key] = value;
          clearStagedValue(name, key);
          if (!isSchemaConfig(project[key])) {
            // Legacy loaders historically publish each accepted key immediately;
            // later custom loaders can therefore derive values from earlier ones.
            const liveProject = ((configuration as unknown as ConfigStore)[name] ??= {});
            liveProject[key] = value;
          }
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

    await finalizeConfig();

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
    if (finalized) {
      mergeStore(configuration as unknown as ConfigStore, merge);
      return configuration;
    }
    // Public callers provide output-shaped values. Keep them separate from raw
    // bootstrap/loader inputs and publish them again after schema processing.
    mergeStore(stagedConfiguration, merge);
    mergeStore(configuration as unknown as ConfigStore, merge);
    return configuration;
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
   * @throws {BootstrapException} `CONFIGURATION_DEFINITION_INVALID` when a
   *   definition is malformed, `CONFIG_SCHEMA_UNSUPPORTED` when a schema
   *   provider surface is unsupported, or `CONFIG_SCHEMA_AMBIGUOUS` when it
   *   exposes multiple providers.
   * @internal
   */
  function loadProject(library: string, definitions: CodeConfigDefinition) {
    // guard against double-registration (e.g. test re-runs, appendLibrary replacing)
    if (loaded.has(library)) {
      return;
    }
    loaded.add(library);
    const rawProject = (rawConfiguration[library] ??= {});
    const liveProject = ((configuration as unknown as ConfigStore)[library] ??= {});
    Object.keys(definitions).forEach(property => {
      const definition = definitions[property];
      const location = { context, project: library, property };
      assertConfigEntry(definition, location);
      if (isSchemaConfig(definition)) {
        const schemaMetadata = getSchemaMetadata(definition.schema, location);
        metadata.push({
          ...schemaMetadata,
          library,
          property,
          required: definition.required,
          source: definition.source ? [...definition.source] : undefined,
        });
      } else {
        if (Object.hasOwn(definition, "default")) {
          rawProject[property] = definition.default;
          // Legacy defaults historically remain visible during construction.
          liveProject[property] = definition.default;
        }
        const legacyMetadata: ConfigMetadataDescriptor = {
          description: is.array(definition.description)
            ? definition.description.join(". ")
            : definition.description,
          library,
          property,
          provider: "legacy",
          required: definition.required,
          source: definition.source ? [...definition.source] : undefined,
          type: definition.type,
          default: Object.hasOwn(definition, "default")
            ? getDefaultMetadata(definition.default)
            : undefined,
        };
        metadata.push(legacyMetadata);
      }
    });
    configDefinitions.set(library, definitions);
    // Apply only this project's bootstrap values directly. The definitions for
    // later projects are not known yet, so no deep merge may clone their schema
    // inputs before the key-aware merge phase.
    const bootConfig = (internal.boot.options?.configuration as Record<string, unknown>)?.[library];
    if (is.object(bootConfig)) {
      Object.keys(bootConfig).forEach(property => {
        const value = (bootConfig as Record<string, unknown>)[property];
        rawProject[property] = value;
        clearStagedValue(library, property);
        const definition = definitions[property];
        if (definition && !isSchemaConfig(definition)) {
          liveProject[property] = value;
        }
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
     * @internal
     */
    [MERGE_RAW]: mergeRawConfiguration,

    /**
     * Retrieve the metadata that was originally used to define the configs.
     */
    getDefinitions: () => configDefinitions,

    /** Return a safe metadata view for scanner/help consumers. */
    getMetadata: () =>
      metadata.map(entry => ({
        ...entry,
        source: entry.source ? [...entry.source] : undefined,
      })),

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
