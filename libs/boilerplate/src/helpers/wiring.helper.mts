import { EventEmitter } from "eventemitter3";
import { Logger } from "pino";

import { TCache } from "../extensions/cache.extension.mjs";
import { OptionalModuleConfiguration } from "../extensions/configuration.extension.mjs";
import { ILogger } from "../extensions/logger.extension.mjs";
import {
  AbstractConfig,
  AnyConfig,
  BooleanConfig,
  NumberConfig,
  StringConfig,
} from "./config.helper.mjs";
import { TChildLifecycle, TLifecycleBase } from "./lifecycle.helper.mjs";

export type TServiceReturn<OBJECT extends object = object> = void | OBJECT;

export type TModuleMappings = Record<string, ServiceFunction>;
export type TResolvedModuleMappings = Record<string, TServiceReturn>;

export type ApplicationConfigurationOptions<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = {
  name?: string;
  services?: S;
  libraries?: ZCCLibraryDefinition<ServiceMap, OptionalModuleConfiguration>[];
  configuration?: C;
};

export type TConfigurable<
  S extends ServiceMap = ServiceMap,
  C extends OptionalModuleConfiguration = OptionalModuleConfiguration,
> = ZCCLibraryDefinition<S, C> | ZCCApplicationDefinition<S, C>;

export type TGetConfig<PARENT extends TConfigurable = TConfigurable> = <
  K extends keyof ExtractConfig<PARENT>,
>(
  key: K,
) => CastConfigResult<ExtractConfig<PARENT>[K]>;

export type GetApisResult<S extends ServiceMap> = {
  [K in keyof S]: ReturnType<S[K]> extends Promise<infer AsyncResult>
    ? AsyncResult
    : ReturnType<S[K]>;
};

type ExtractConfig<T> =
  T extends ZCCLibraryDefinition<ServiceMap, infer C> ? C : never;

type TGetApi = <S extends ServiceMap, C extends OptionalModuleConfiguration>(
  project: TConfigurable<S, C>,
) => GetApisResult<S>;

export type TServiceParams = {
  context: string;
  logger: ILogger;
  lifecycle: TLifecycleBase;
  event: EventEmitter;
  getApis: TGetApi;
  cache: TCache;
};
export type GetApis<T> =
  T extends ZCCLibraryDefinition<infer S, OptionalModuleConfiguration>
    ? GetApisResult<S>
    : T extends ZCCApplicationDefinition<infer S, OptionalModuleConfiguration>
      ? GetApisResult<S>
      : never;

type CastConfigResult<T extends AnyConfig> = T extends StringConfig
  ? string
  : T extends BooleanConfig
    ? boolean
    : T extends NumberConfig
      ? number
      : // Add other mappings as needed
        unknown;

export type Loader<PARENT extends TConfigurable> = <
  K extends keyof PARENT["services"],
>(
  serviceName: K,
) => ReturnType<PARENT["services"][K]> extends Promise<infer AsyncResult>
  ? AsyncResult
  : ReturnType<PARENT["services"][K]>;

export type ServiceFunction<R = unknown> = (
  params: TServiceParams,
) => R | Promise<R>;
export type ServiceMap = Record<string, ServiceFunction>;
export type LibraryConfigurationOptions<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = {
  name: string;
  services: S;
  configuration?: C;
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

export type ZCCLibraryDefinition<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = LibraryConfigurationOptions<S, C> &
  Wire & {
    getConfig: <K extends keyof C>(property: K) => CastConfigResult<C[K]>;
    lifecycle: TChildLifecycle;
    onError: (callback: onErrorCallback) => void;
  };

export type ZCCApplicationDefinition<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = ApplicationConfigurationOptions<S, C> &
  Wire & {
    bootstrap: (options?: BootstrapOptions) => Promise<void>;
    getConfig: <K extends keyof C>(property: K) => CastConfigResult<C[K]>;
    lifecycle: TChildLifecycle;
    onError: (callback: onErrorCallback) => void;
    teardown: () => Promise<void>;
  };
