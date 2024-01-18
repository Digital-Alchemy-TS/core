import { EventEmitter } from "eventemitter3";
import { Logger } from "pino";

import {
  ModuleConfiguration,
  OptionalModuleConfiguration,
} from "../extensions/configuration.extension.mjs";
import { ILogger } from "../extensions/logger.extension.mjs";
import { AbstractConfig } from "./config.helper.mjs";
import { TChildLifecycle, TLifecycleBase } from "./lifecycle.helper.mjs";

export type TServiceReturn<OBJECT extends object = object> = void | OBJECT;

export type TModuleMappings = Record<string, TServiceDefinition>;
export type TResolvedModuleMappings = Record<string, TServiceReturn>;
type ServiceListing = Array<[name: string, loader: TServiceDefinition]>;

export type ApplicationConfigurationOptions = {
  name?: string;
  services?: ServiceListing;
  libraries?: ZCCLibraryDefinition[];
  configuration?: OptionalModuleConfiguration;
};

export type ApplicationDefinition = {
  configuration: ModuleConfiguration;
  getConfig: <T>(property: string) => T;
  getLibraries: () => never[];
  getServiceList: () => [name: string, loader: TServiceDefinition][];
  lifecycle: TLifecycleBase;
  logger: ILogger;
  name: string;
};

export type TGetConfig = <T>(
  property: string | [project: string, property: string],
) => T;

export type TServiceParams<T extends object = object> = {
  logger: ILogger;
  lifecycle: TLifecycleBase;
  loader: Loader<T>;
  getConfig: TGetConfig;
  event: EventEmitter;
};
export type TServiceDefinition = (parameters: TServiceParams) => TServiceReturn;

export type Loader<T extends object = object> = (
  service: string | TServiceDefinition,
) => TServiceReturn<T>;

export type LibraryConfigurationOptions = {
  name: string;
  services?: [name: string, service: TServiceDefinition][];
  configuration?: OptionalModuleConfiguration;
};

type onErrorCallback = () => void;

export type BootstrapOptions = {
  /**
   * default: true
   */
  handleGlobalErrors?: boolean;
  /**
   * default values to use for configurations, before user values come in
   */
  configuration?: Partial<AbstractConfig>;
  /**
   * use this logger, instead of the baked in one. Maybe you want some custom transports or something? Put your customized thing here
   */
  customLogger?: Logger;
  /**
   * application level flags
   */
  flags?: Record<string, boolean | number | string>;
};

type Wire = {
  /**
   * Internal method used in bootstrapping, do not call elsewhere
   *
   * - initializes lifecycle
   * - attaches event emitters
   */
  wire: () => Promise<TChildLifecycle>;
};

export type ZCCLibraryDefinition = LibraryConfigurationOptions &
  Wire & {
    getConfig: <T>(property: string) => T;
    lifecycle: TChildLifecycle;
    onError: (callback: onErrorCallback) => void;
  };

export type ZCCApplicationDefinition = ApplicationConfigurationOptions &
  Wire & {
    bootstrap: (options?: BootstrapOptions) => Promise<void>;
    getConfig: <T>(property: string) => T;
    lifecycle: TChildLifecycle;
    onError: (callback: onErrorCallback) => void;
    teardown: () => Promise<void>;
  };
