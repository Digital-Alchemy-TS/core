import {
  deepExtend,
  DOWN,
  eachSeries,
  INVERT_VALUE,
  is,
  LABEL,
  PAIR,
  SINGLE,
  START,
  UP,
  VALUE,
  ZCC,
} from "@zcc/utilities";
import { existsSync, readFileSync } from "fs";
import { decode } from "ini";
import { load } from "js-yaml";
import minimist from "minimist";
import { get, set } from "object-path";
import { homedir } from "os";
import { join } from "path";
import { argv, cwd, env, platform } from "process";

import { BootstrapException } from "../helpers/errors.helper.mjs";

export type ZccConfigTypes =
  | "string"
  | "boolean"
  | "internal"
  | "number"
  | "record"
  | "string[]";
const extensions = ["json", "ini", "yaml", "yml"];

export type AnyConfig =
  | StringConfig
  | BooleanConfig
  | InternalConfig
  | NumberConfig
  | RecordConfig
  | StringArrayConfig;

const ENVIRONMENT_LOAD_PRIORITY = 1;
const FILE_LOAD_PRIORITY = 2;

let overrideConfigFiles: string[] = [];

export interface BaseConfig {
  /**
   * If no other values are provided, what value should be injected?
   * This ensures a value is always provided, and checks for undefined don't need to happen
   */
  default?: unknown;
  /**
   * Short descriptive text so humans can understand why this exists.
   * Ideally should fit on a single line
   */
  description?: string;
  /**
   * Refuse to boot if user provided value is not present.
   * This value cannot be defaulted, and it is absolutely required in order to do anything
   */
  required?: boolean;

  type: ZccConfigTypes;
}

type StringFlags = "password" | "url";

const APPLICATION = Symbol("APPLICATION_CONFIGURATION");
type KnownConfigs = Map<string | typeof APPLICATION, Record<string, AnyConfig>>;

function loadConfigFromFile(out: Partial<AbstractConfig>, filePath: string) {
  if (!existsSync(filePath)) {
    return out;
  }
  const fileContent = readFileSync(filePath, "utf8").trim();
  const hasExtension = extensions.some(extension => {
    if (
      filePath.slice(extension.length * INVERT_VALUE).toLowerCase() ===
      extension
    ) {
      switch (extension) {
        case "ini":
          deepExtend(out, decode(fileContent) as unknown as AbstractConfig);
          return true;
        case "yaml":
        case "yml":
          deepExtend(out, load(fileContent) as AbstractConfig);
          return true;
        case "json":
          deepExtend(out, JSON.parse(fileContent) as unknown as AbstractConfig);
          return true;
      }
    }
    return false;
  });
  if (hasExtension) {
    return undefined;
  }
  // Guessing JSON
  if (fileContent[START] === "{") {
    deepExtend(out, JSON.parse(fileContent) as unknown as AbstractConfig);
    return true;
  }
  // Guessing yaml
  try {
    const content = load(fileContent);
    if (is.object(content)) {
      deepExtend(out, content as unknown as AbstractConfig);
      return true;
    }
  } catch {
    // Is not a yaml file
  }
  // Final fallback: INI
  deepExtend(out, decode(fileContent) as unknown as AbstractConfig);
  return true;
}

export interface StringConfig extends BaseConfig {
  default?: string;
  /**
   * If provided, the value **MUST** appear in this list or the application will refuse to boot.
   */
  enum?: string[];
  /**
   * Currently no effect on runtime. Used as metadata for building `config-builder` app
   */
  flags?: StringFlags[];
  type: "string";
}

export interface BooleanConfig extends BaseConfig {
  default?: boolean;
  type: "boolean";
}

/**
 * For configurations that just can't be expressed any other way.
 * Make sure to add a helpful description on how to format the value,
 * because `config-builder` won't be able to help.
 *
 * This can be used to take in a complex json object, and forward the information to another library.
 *
 * TODO: JSON schema magic for validation / maybe config builder help
 */
export interface InternalConfig extends BaseConfig {
  default?: unknown;
  type: "internal";
}

export interface NumberConfig extends BaseConfig {
  default?: number;
  type: "number";
}

/**
 * key/value pairs
 */
export interface RecordConfig extends BaseConfig {
  type: "record";
}

export interface StringArrayConfig extends BaseConfig {
  default?: string[];
  type: "string[]";
}

/**
 * Used with config scanner
 */
export interface ConfigDefinitionDTO {
  application: string;
  bootstrapOverrides?: AbstractConfig;
  config: ConfigTypeDTO[];
}

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
 * Top level configuration object
 *
 * Extends the global common config, adding a section for the top level application to chuck in data without affecting things
 * Also provides dedicated sections for libraries to store their own configuration options
 */
export interface AbstractConfig {
  application: Record<string, unknown>;
  libs: Record<string, Record<string, unknown>>;
}

const CLI_SWITCHES = minimist(argv);
const isWindows = platform === "win32";

function withExtensions(path: string): string[] {
  return [path, ...extensions.map(i => `${path}.${i}`)];
}

type ConfigLoaderReturn = Promise<Partial<AbstractConfig>>;

type ConfigLoader = [
  loader: (definedConfigurations: KnownConfigs) => ConfigLoaderReturn,
  priority: number,
];

export function configFilePaths(name = "zcc"): string[] {
  const out: string[] = [];
  if (!isWindows) {
    out.push(
      ...withExtensions(join(`/etc`, name, "config")),
      ...withExtensions(join(`/etc`, `${name}rc`)),
    );
  }
  let current = cwd();
  let next: string;
  while (!is.empty(current)) {
    out.push(join(current, `.${name}rc`));
    next = join(current, "..");
    if (next === current) {
      break;
    }
    current = next;
  }
  out.push(
    ...withExtensions(join(homedir(), ".config", name)),
    ...withExtensions(join(homedir(), ".config", name, "config")),
  );
  return out;
}

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

export async function ConfigLoaderEnvironment(
  configs: KnownConfigs,
): ConfigLoaderReturn {
  const environmentKeys = Object.keys(env);
  const switchKeys = Object.keys(CLI_SWITCHES);
  const out: Partial<AbstractConfig> = {};
  configs.forEach((configuration, project) => {
    const isApplication = !is.string(project);
    const cleanedProject =
      (isApplication ? ZCC.application?.name : project)?.replaceAll("-", "_") ||
      "unknown";
    const environmentPrefix = isApplication
      ? "application"
      : `libs_${cleanedProject}`;
    const configPrefix = isApplication ? "application" : `libs.${project}`;
    Object.keys(configuration).forEach(key => {
      const noAppPath = `${environmentPrefix}_${key}`;
      const search = [noAppPath, key];
      const configPath = `${configPrefix}.${key}`;
      // Find an applicable switch
      const flag =
        // Find an exact match (if available) first
        search.find(line => switchKeys.includes(line)) ||
        // Do case insensitive searches
        search.find(line => {
          const match = new RegExp(
            `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
            "gi",
          );
          return switchKeys.some(item => item.match(match));
        });
      if (flag) {
        const formattedFlag = switchKeys.find(key =>
          search.some(line =>
            key.match(
              new RegExp(
                `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
                "gi",
              ),
            ),
          ),
        );
        if (is.string(formattedFlag)) {
          set(out, configPath, CLI_SWITCHES[formattedFlag]);
        }
        return;
      }
      // Find an environment variable
      const environment =
        // Find an exact match (if available) first
        search.find(line => environmentKeys.includes(line)) ||
        // Do case insensitive searches
        search.find(line => {
          const match = new RegExp(
            `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
            "gi",
          );
          return environmentKeys.some(item => item.match(match));
        });
      if (is.empty(environment)) {
        return;
      }
      const environmentName = environmentKeys.find(key =>
        search.some(line =>
          key.match(
            new RegExp(
              `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
              "gi",
            ),
          ),
        ),
      );
      if (is.string(environmentName)) {
        set(out, configPath, env[environmentName]);
      }
    });
  });

  return out;
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

export async function ConfigLoaderFile(): ConfigLoaderReturn {
  const files = is.empty(overrideConfigFiles)
    ? configFilePaths(ZCC.application?.name)
    : overrideConfigFiles;
  const out: Partial<AbstractConfig> = {};
  files.forEach(file => loadConfigFromFile(out, file));
  return out;
}
export type ModuleConfiguration = Record<string, AnyConfig>;
export type OptionalModuleConfiguration = ModuleConfiguration | undefined;

function CreateConfiguration() {
  let application: string;
  const configLoaders = new Set<ConfigLoader>();
  const configuration: AbstractConfig = { application: {}, libs: {} };
  const configDefinitions: KnownConfigs = new Map();
  const logger = ZCC.logger.context("configuration.extension");

  function defaultLoaders() {
    configLoaders.add([ConfigLoaderEnvironment, ENVIRONMENT_LOAD_PRIORITY]);
    configLoaders.add([ConfigLoaderFile, FILE_LOAD_PRIORITY]);
  }

  function getConfiguration(
    path: string,
    dynamic: AnyConfig | undefined,
  ): BaseConfig {
    const parts = path.split(".");
    if (parts.length === SINGLE) {
      parts.unshift(application);
    }
    if (parts.length === PAIR) {
      const configuration = configDefinitions.get(application) || {};
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
    addApplicationDefinition: (definitions: Record<string, AnyConfig>) =>
      configDefinitions.set(APPLICATION, definitions),
    addConfigLoader: (loader: ConfigLoader) => configLoaders.add(loader),
    addLibraryDefinition: (
      library: string,
      definitions: Record<string, AnyConfig>,
    ) => configDefinitions.set(library, definitions),
    configuration,
    defaultLoaders,
    get<T extends unknown = string>(
      path: string | [library: string, config: string],
      /**
       * Do not provide if it was provided with the module
       */
      dynamic?: AnyConfig,
    ): T {
      if (is.array(path)) {
        path =
          path[LABEL] === ZCC.application?.name
            ? ["application", path[VALUE]].join(".")
            : ["libs", path[LABEL], path[VALUE]].join(".");
      }
      const current = get(configuration, path);
      const config = getConfiguration(path, dynamic);
      const defaultValue = config?.default;
      const value = current ?? defaultValue;

      return cast(value, config?.type ?? "string") as T;
    },
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
      if (is.array(path)) {
        path = ["libs", path[LABEL], path[VALUE]].join(".");
      }
      set(configuration, path, value);
    },
    setOverrideConfigFiles: (files: string[]) => (overrideConfigFiles = files),
  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    config: ReturnType<typeof CreateConfiguration>;
  }
}

ZCC.config = CreateConfiguration();
