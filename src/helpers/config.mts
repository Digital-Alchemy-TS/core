import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";

import dotenv from "@dotenvx/dotenvx";
import type { ParsedArgs } from "minimist";

import type {
  INITIALIZE,
  INJECTED_DEFINITIONS,
  InternalDefinition,
  LOAD_PROJECT,
} from "../index.mts";
import { is } from "../index.mts";
import type { ILogger } from "./logger.mts";
import type { TBlackHole } from "./utilities.mts";
import type {
  ApplicationDefinition,
  PartialConfiguration,
  ServiceMap,
  TInjectedConfig,
} from "./wiring.mts";

// --- Loader source types ------------------------------------------------------

/**
 * Describes the three built-in configuration source channels.
 *
 * @remarks
 * Used as the key set for {@link DataTypes} and for the `source` field on
 * individual config definitions. Each channel can be opted in/out independently
 * via `BootstrapOptions.configSources`.
 */
export interface ConfigLoaderSource {
  /**
   * will be checked for values unless `sources` is defined without argv
   */
  argv: true;
  /**
   * will be checked for values unless `env` is defined without argv
   */
  env: true;
  /**
   * will be checked for values unless `file` is defined without argv
   */
  file: true;
}

// --- Config shape types -------------------------------------------------------

/** A record of config-key → config-definition for a single module. */
export type CodeConfigDefinition = Record<string, AnyConfig>;

/**
 * All supported primitive config types.
 *
 * @remarks
 * Each value maps to a concrete config interface (`StringConfig`,
 * `BooleanConfig`, etc.) and determines how the raw string from env/argv/file
 * is coerced before injection.
 */
export type ProjectConfigTypes =
  | "string"
  | "boolean"
  | "internal"
  | "number"
  | "record"
  | "string[]";

/**
 * Union of all supported config definition shapes.
 *
 * @remarks
 * Narrowing on the `type` discriminant gives access to the specific fields
 * (e.g., `enum` for `StringConfig`, `default` for every typed config).
 */
export type AnyConfig =
  | StringConfig<string>
  | BooleanConfig
  | InternalConfig<object>
  | NumberConfig
  | RecordConfig
  | StringArrayConfig;

/**
 * Fields shared by every config definition.
 *
 * @remarks
 * The `type` discriminant drives coercion in {@link parseConfig}.
 * `source` narrows which loaders are allowed to supply this key — omit it to
 * allow all loaders.
 */
export interface BaseConfig {
  /**
   * If no other values are provided, what value should be injected?
   * This ensures a value is always provided, and checks for undefined don't need to happen
   */
  default?: unknown;
  /**
   * Short descriptive text so humans can understand why this exists.
   */
  description?: string | string[];
  /**
   * Refuse to boot if user provided value is still undefined by `onPostConfig` lifecycle event
   */
  required?: boolean;

  type: ProjectConfigTypes;

  /**
   * Where this can be loaded from
   */
  source?: (keyof ConfigLoaderSource)[];
}

/**
 * Map of module-name → config-definition record for all known modules.
 *
 * @remarks
 * Populated incrementally during bootstrap as each library calls
 * `configuration.[LOAD_PROJECT]`. Used by all config loaders to know which
 * keys to look up.
 */
export type KnownConfigs = Map<string, CodeConfigDefinition>;

/**
 * Config definition for a typed string value.
 *
 * @remarks
 * The generic parameter `STRING` lets callers constrain the injected value to a
 * specific string literal union. When `enum` is provided the framework refuses
 * to boot if the resolved value is not in the list.
 *
 * @example Enum-constrained string
 * ```typescript
 * const LOG_LEVEL: StringConfig<"debug" | "info" | "warn"> = {
 *   default: "info",
 *   enum: ["debug", "info", "warn"],
 *   type: "string",
 * };
 * ```
 */
export interface StringConfig<STRING extends string> extends BaseConfig {
  default?: STRING;
  /**
   * If provided, the value **MUST** appear in this list or the application will refuse to boot.
   */
  enum?: STRING[];
  type: "string";
}

/** Config definition for a boolean value. */
export interface BooleanConfig extends BaseConfig {
  default?: boolean;
  type: "boolean";
}

/**
 * Escape hatch for configurations that can't be expressed as a primitive.
 *
 * @remarks
 * Accepts a JSON-serialisable object as its default; at runtime the raw string
 * value from env/file is passed through `JSON.parse`. Use the `description`
 * field to explain the expected structure, because `config-builder` cannot
 * introspect complex shapes.
 *
 * This can be used to take in a complex json object, and forward the information to another library.
 *
 * TODO: JSON schema magic for validation / maybe config builder help
 *
 * For configurations that just can't be expressed any other way.
 * Make sure to add a helpful description on how to format the value,
 * because `config-builder` won't be able to help.
 */
export type InternalConfig<VALUE extends object> = BaseConfig & {
  default: VALUE;
  type: "internal";
};

/** Config definition for a numeric value. */
export interface NumberConfig extends BaseConfig {
  default?: number;
  type: "number";
}

/**
 * Config definition for an arbitrary key/value record.
 *
 * @remarks
 * Injected as a plain object; the raw value is parsed via `JSON.parse` when it
 * arrives as a string.
 *
 * key/value pairs
 */
export interface RecordConfig extends BaseConfig {
  type: "record";
}

/** Config definition for a string-array value. */
export interface StringArrayConfig extends BaseConfig {
  default?: string[];
  type: "string[]";
}

// --- DTO types used by external config tooling --------------------------------

/**
 * Serialisable representation of a module's full config for use by external
 * tooling (e.g. the `config-builder` CLI scanner).
 *
 * Used with config scanner
 */
export interface ConfigDefinitionDTO {
  application: string;
  bootstrapOverrides?: AbstractConfig;
  config: ConfigTypeDTO[];
}

/** Single config-item descriptor emitted by the scanner. */
export interface ConfigTypeDTO<METADATA extends AnyConfig = AnyConfig> {
  /**
   * Name of project
   */
  library: string;
  /**
   * Description of a single config item as passed into the module
   */
  metadata: METADATA;
  /**
   * Property name
   */
  property: string;
}

/**
 * Top level configuration object.
 *
 * @remarks
 * Downstream libraries extend this interface via declaration merging to add
 * their own config sections. See the architecture docs for the merging pattern.
 *
 * Extends the global common config, adding a section for the top level application to chuck in data without affecting things
 * Also provides dedicated sections for libraries to store their own configuration options
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AbstractConfig {}

/**
 * Return type of a config loader — a partial snapshot of the global config
 * hierarchy.
 */
export type ConfigLoaderReturn = Promise<Partial<AbstractConfig>>;

/**
 * Parameters passed to every config loader at bootstrap time.
 *
 * @remarks
 * Loaders receive the full application definition, the accumulated
 * `KnownConfigs` map, the internal definition for accessing boot state, and a
 * logger for diagnostics. Loaders must not throw; they should return an empty
 * object when they find nothing.
 */
export type ConfigLoaderParams<
  S extends ServiceMap = ServiceMap,
  C extends OptionalModuleConfiguration = OptionalModuleConfiguration,
> = {
  application: ApplicationDefinition<S, C>;
  configs: KnownConfigs;
  internal: InternalDefinition;
  logger: ILogger;
};

/**
 * Contract that all config loaders must satisfy.
 *
 * @remarks
 * Each loader is registered for a specific {@link DataTypes} channel via
 * `DigitalAlchemyConfiguration.registerLoader`. The framework calls all
 * registered loaders during `onPostConfig` and deep-merges their results.
 */
export type ConfigLoader = <S extends ServiceMap, C extends OptionalModuleConfiguration>(
  params: ConfigLoaderParams<S, C>,
) => ConfigLoaderReturn;

/**
 * Coerce a raw string (or boolean/array from argv parsing) to the target type.
 *
 * @remarks
 * Called by env/argv loaders after key lookup to normalise the raw value before
 * it is stored in the config map. `boolean` coercion is intentionally lenient:
 * `"true"`, `"y"`, and `"1"` all produce `true`. `string[]` handles the
 * minimist edge case where a single flag value arrives as a plain string rather
 * than a one-element array.
 */
export function cast<T = unknown>(data: boolean | number[] | string | string[], type: string): T {
  switch (type) {
    case "boolean": {
      data ??= "";
      return (
        is.boolean(data) ? data : ["true", "y", "1"].includes((data as string).toLowerCase())
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

/** A record that maps config-key names to their config definitions. */
export type ModuleConfiguration = {
  [key: string]: AnyConfig;
};

/** A module's config block, or `undefined` when the module declares none. */
export type OptionalModuleConfiguration = ModuleConfiguration | undefined;

/**
 * Find the first key in `source` that also appears in `find`, using a
 * case-insensitive fuzzy match that treats `-` and `_` as interchangeable.
 *
 * @remarks
 * The search runs in two passes:
 * 1. Exact match — fast path for the common case where cases and separators align.
 * 2. Regex match — builds a pattern from `source[i]` that allows `-` or `_`
 *    between each word boundary, then tests every element of `find`.
 *
 * This is the canonical key-resolution routine called by the env and argv
 * loaders before falling back to unqualified key search.
 */
export function findKey<T extends string>(source: T[], find: T[]) {
  return (
    // Find an exact match (if available) first
    source.find(line => find.includes(line)) ||
    // Do case insensitive searches
    source.find(line => {
      const match = new RegExp(`^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`, "gi");
      return find.some(item => item.match(match));
    })
  );
}

/**
 * Search `source` for the first key that case-insensitively matches `target`,
 * treating `-` and `_` as interchangeable separators.
 *
 * @remarks
 * Builds a single regex from `target` and tests it against every element of
 * `source`. Unlike {@link findKey}, this function operates in one direction
 * only (target → source) and is used for direct key lookups rather than
 * cross-set intersection.
 */
export function iSearchKey(target: string, source: string[]) {
  const regex = new RegExp(`^${target.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`, "gi");

  return source.find(key => regex.exec(key) !== null);
}

/**
 * Load a `.env` file into `process.env`, respecting the configured priority
 * order.
 *
 * @remarks
 * Priority (highest to lowest):
 * 1. `--env-file` CLI switch
 * 2. `BootstrapOptions.envFile`
 * 3. `.env` in the current working directory (silent fallback)
 *
 * If the resolved path does not exist, a warning is emitted and loading is
 * skipped rather than throwing. This keeps the application bootable in
 * environments that intentionally have no `.env` file.
 *
 * priorities:
 * - --env-file
 * - bootstrap envFile
 * - cwd/.env (default file)
 */
export function loadDotenv(
  internal: InternalDefinition,
  CLI_SWITCHES: ParsedArgs,
  logger: ILogger,
) {
  internal.boot.options ??= {};
  let { envFile } = internal.boot.options;
  const switchKeys = Object.keys(CLI_SWITCHES);
  const searched = iSearchKey("env-file", switchKeys);

  // --env-file > bootstrap
  if (!is.empty(CLI_SWITCHES[searched])) {
    envFile = CLI_SWITCHES[searched];
  }

  let file: string;

  // * was provided an --env-file or something via boot
  if (!is.empty(envFile)) {
    const checkFile = path.isAbsolute(envFile)
      ? path.normalize(envFile)
      : path.join(cwd(), envFile);
    if (fs.existsSync(checkFile)) {
      file = checkFile;
    } else {
      // path was explicitly provided but does not exist; warn so operators notice the misconfiguration
      logger.warn({ checkFile, envFile, name: loadDotenv }, "invalid target for dotenv file");
    }
  }

  // * attempt default file
  if (is.empty(file)) {
    const defaultFile = path.join(cwd(), ".env");
    if (fs.existsSync(defaultFile)) {
      file = defaultFile;
    } else {
      logger.debug({ name: loadDotenv }, "no .env found");
    }
  }

  // ? each of the steps above verified the path as valid
  if (!is.empty(file)) {
    logger.trace({ file, name: loadDotenv }, `loading env file`);
    dotenv.config({ override: true, path: file, quiet: true });
  }
}

/**
 * Coerce `value` to the concrete type described by `config`.
 *
 * @remarks
 * Called after a raw value has been retrieved from a loader to normalise it
 * before storage. Each branch matches a `ProjectConfigTypes` discriminant:
 * - `"string"` — `String(value)`
 * - `"number"` — `Number(value)`
 * - `"string[]"` — splits on commas, or parses JSON arrays starting with `[`
 * - `"record"` / `"internal"` — passes objects through; parses strings as JSON
 * - `"boolean"` — accepts boolean literals and the strings `"y"` / `"true"`
 */
export function parseConfig(config: AnyConfig, value: unknown) {
  switch (config.type) {
    case "string": {
      return String(value);
    }
    case "number": {
      return Number(value);
    }
    case "string[]":
      if (is.array(value)) {
        return value;
      }
      if (is.string(value)) {
        // leading "[" signals a JSON-serialised array; otherwise treat as CSV
        return value.startsWith("[") ? JSON.parse(value) : value.split(",");
      }
      return [];
    case "record":
    case "internal": {
      if (is.object(value)) {
        return value;
      }
      return JSON.parse(String(value));
    }
    case "boolean": {
      if (is.boolean(value)) {
        return value;
      }
      if (!is.string(value)) {
        return false;
      }
      return ["y", "true"].includes(value.toLowerCase());
    }
  }
}

/**
 * Internal shape of the configuration service — the object attached to
 * `internal.boilerplate.configuration`.
 *
 * @remarks
 * Symbol-keyed methods (`[INITIALIZE]`, `[INJECTED_DEFINITIONS]`,
 * `[LOAD_PROJECT]`) are bootstrap-internal surface and should not be called by
 * application code. Use the named methods (`getDefinitions`, `registerLoader`,
 * `merge`, `onUpdate`, `set`) for runtime configuration interaction.
 *
 * @internal
 */
export type DigitalAlchemyConfiguration = {
  [INITIALIZE]: <S extends ServiceMap, C extends OptionalModuleConfiguration>(
    application: ApplicationDefinition<S, C>,
  ) => Promise<string>;
  [INJECTED_DEFINITIONS]: TInjectedConfig;
  [LOAD_PROJECT]: (library: string, definitions: CodeConfigDefinition) => void;
  getDefinitions: () => KnownConfigs;
  registerLoader: (loader: ConfigLoader, type: DataTypes) => void;
  merge: (incoming: Partial<PartialConfiguration>) => PartialConfiguration;
  /**
   * Subscribe to runtime config changes made via `config.set`.
   *
   * @remarks
   * Not a replacement for `onPostConfig`
   *
   * Only receives updates from `config.set` calls — initial load values do not
   * trigger this callback.
   */
  onUpdate: <
    Project extends keyof TInjectedConfig,
    Property extends Extract<keyof TInjectedConfig[Project], string>,
  >(
    callback: OnConfigUpdateCallback<Project, Property>,
    project?: Project,
    property?: Property,
  ) => void;
  /**
   * type friendly method of updating a single configuration
   *
   * emits update event
   */
  set: TSetConfig;
};

/**
 * Type-safe setter for a single config value.
 *
 * @remarks
 * The generic parameters are inferred from the call site — TypeScript enforces
 * that `property` is a valid key of the chosen `project` section and that
 * `value` matches the declared type.
 */
export type TSetConfig = <
  Project extends keyof TInjectedConfig,
  Property extends keyof TInjectedConfig[Project],
>(
  project: Project,
  property: Property,
  value: TInjectedConfig[Project][Property],
) => void;

/**
 * Callback signature for config-update subscriptions.
 *
 * @remarks
 * Receives the `project` and `property` names that changed; callers read the
 * new value directly from `config[project][property]` rather than receiving it
 * as a parameter, which keeps the callback signature stable regardless of the
 * value type.
 */
export type OnConfigUpdateCallback<
  Project extends keyof TInjectedConfig,
  Property extends keyof TInjectedConfig[Project],
> = (project: Project, property: Property) => TBlackHole;

/** Union of the three supported config source channel names. */
export type DataTypes = keyof ConfigLoaderSource;
