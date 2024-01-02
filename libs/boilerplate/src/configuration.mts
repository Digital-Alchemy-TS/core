/* eslint-disable @typescript-eslint/no-magic-numbers */
import { deepExtend, DOWN, eachSeries, UP, ZCC } from "@zcc/utilities";

export type DigitalAlchemyConfigTypes =
  | "string"
  | "boolean"
  | "internal"
  | "number"
  | "record"
  | "string[]";

export type AnyConfig =
  | StringConfig
  | BooleanConfig
  | InternalConfig
  | NumberConfig
  | RecordConfig
  | StringArrayConfig;

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

  type: DigitalAlchemyConfigTypes;
}

type StringFlags = "password" | "url";

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

export const INJECTED_DYNAMIC_CONFIG = "INJECTED_DYNAMIC_CONFIG";

type ConfigLoaderReturn = Promise<Partial<AbstractConfig>>;

type ConfigLoader = [
  loader: (application: string) => ConfigLoaderReturn,
  priority: number,
];

export async function ConfigLoaderEnvironment(): ConfigLoaderReturn {
  return {
    //
  };
}

export async function ConfigLoaderSwitches(): ConfigLoaderReturn {
  return {
    //
  };
}

export async function ConfigLoaderYaml(): ConfigLoaderReturn {
  return {
    //
  };
}

export async function ConfigLoaderIni(): ConfigLoaderReturn {
  return {
    //
  };
}

export async function ConfigLoaderJson(): ConfigLoaderReturn {
  return {
    //
  };
}

function CreateConfiguration() {
  const configLoaders = new Set<ConfigLoader>();
  const configuration: AbstractConfig = { application: {}, libs: {} };

  return {
    addConfigLoader: (loader: ConfigLoader) => configLoaders.add(loader),
    defaultLoaders: () => {
      configLoaders.add([ConfigLoaderYaml, 0]);
      configLoaders.add([ConfigLoaderIni, 0]);
      configLoaders.add([ConfigLoaderJson, 0]);
      configLoaders.add([ConfigLoaderEnvironment, 0]);
      configLoaders.add([ConfigLoaderSwitches, 0]);
    },
    loadConfig: async (application: string) => {
      await eachSeries(
        [...configLoaders.values()].sort(([, a], [, b]) => (a > b ? UP : DOWN)),
        async ([loader]) => {
          const merge = await loader(application);
          deepExtend(configuration, merge);
        },
      );
    },
    raw: configuration,
  };
}

declare module "@zcc/utilities" {
  export interface ZCC_Definition {
    config: ReturnType<typeof CreateConfiguration>;
  }
}

ZCC.config = CreateConfiguration();
