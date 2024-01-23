import { is } from "@zcc/utilities";
import { get, set } from "object-path";

import { ServiceMap, ZCCApplicationDefinition } from "./wiring.helper.mjs";

type StringFlags = "password" | "url";
export type CodeConfigDefinition = Record<string, AnyConfig>;
export type ZccConfigTypes =
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

  type: ZccConfigTypes;
}
export type KnownConfigs = Map<string | symbol, CodeConfigDefinition>;
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
export type ConfigLoaderReturn = Promise<Partial<AbstractConfig>>;

export type ConfigLoader = [
  loader: <S extends ServiceMap, C extends OptionalModuleConfiguration>(
    application: ZCCApplicationDefinition<S, C>,
    definedConfigurations: KnownConfigs,
  ) => ConfigLoaderReturn,
  priority: number,
];

export function cast<T = unknown>(data: string | string[], type: string): T {
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

export function initWiringConfig(
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
        if (is.undefined(get(configuration, configPath))) {
          set(configuration, configPath, config.default);
        }
      }
    });
  });
}
export type ModuleConfiguration = {
  [key: string]: AnyConfig;
};
export type OptionalModuleConfiguration = ModuleConfiguration | undefined;
