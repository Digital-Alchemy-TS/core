import { is, ZCC } from "@zcc/utilities";
import { EventEmitter } from "eventemitter3";
import { exit } from "process";

import { BootstrapException } from "../helpers/errors.helper.mjs";
import { TChildLifecycle } from "../helpers/lifecycle.helper.mjs";
import { OptionalModuleConfiguration } from "./configuration.extension.mjs";
import { ILogger } from "./logger.extension.mjs";

export type TServiceReturn<OBJECT extends object = object> = void | OBJECT;

type TModuleMappings = Record<string, TServiceDefinition>;
type TResolvedModuleMappings = Record<string, TServiceReturn>;

export type TServiceParams<T extends object = object> = {
  logger: ILogger;
  lifecycle: TChildLifecycle;
  loader: Loader<T>;
  getConfig: <T>(property: string | [project: string, property: string]) => T;
  event: EventEmitter;
};
export type TServiceDefinition = (parameters: TServiceParams) => TServiceReturn;
const FILE_CONTEXT = "boilerplate:Loader";

export type Loader<T extends object = object> = (
  service: string | TServiceDefinition,
) => TServiceReturn<T>;

export type LibraryConfigurationOptions = {
  library: string;
  services?: TServiceDefinition[];
  configuration?: OptionalModuleConfiguration;
};

export function ZCCLoader() {
  const logger = ZCC.logger.context(FILE_CONTEXT);

  const MODULE_MAPPINGS = new Map<string, TModuleMappings>();
  const LOADED_MODULES = new Map<string, TResolvedModuleMappings>();
  const REVERSE_MODULE_MAPPING = new Map<
    TServiceDefinition,
    [project: string, service: string]
  >();

  function ContextLoader(project: string) {
    return (service: string | TServiceDefinition): TServiceReturn => {
      if (!is.string(service)) {
        const pair = REVERSE_MODULE_MAPPING.get(service);
        service = pair.pop();
      }
      return LOADED_MODULES.get(project)[service];
    };
  }

  function GlobalLoader(service: string | TServiceDefinition): TServiceReturn {
    let project: string;
    if (!is.string(service)) {
      const pair = REVERSE_MODULE_MAPPING.get(service);
      service = pair.pop();
      project = pair.pop();
      return LOADED_MODULES.get(project)[service];
    }
    project = [...MODULE_MAPPINGS.keys()].find(key =>
      Object.keys(MODULE_MAPPINGS.get(key)).includes(service as string),
    );
    return project ? LOADED_MODULES.get(project)[service] : undefined;
  }

  async function Insert(
    project: string,
    service: string,
    definition: TServiceDefinition,
  ) {
    logger.trace(`Inserting %s#%s`, project, service);
    const mappings = MODULE_MAPPINGS.get(project) ?? {};
    if (!is.undefined(mappings[service])) {
      throw new BootstrapException(
        FILE_CONTEXT,
        "DUPLICATE_SERVICE_NAME",
        `${service} is already defined for ${project}`,
      );
    }
    mappings[service] = definition;
    MODULE_MAPPINGS.set(project, mappings);
    return await Initialize(project, service, definition);
  }

  async function Initialize(
    project: string,
    service: string,
    definition: TServiceDefinition,
  ) {
    const context = `${project}:${service}`;
    try {
      logger.trace(`Initializing %s#%s`, project, service);
      const resolved = await definition({
        event: ZCC.event,
        getConfig: <T,>(
          property: string | [project: string, property: string],
        ): T =>
          ZCC.config.get(is.string(property) ? [project, property] : property),
        lifecycle: undefined,
        loader: ContextLoader(project),
        logger: ZCC.logger.context(`${project}:${service}`),
      });
      REVERSE_MODULE_MAPPING.set(definition, [project, service]);
      const loaded = LOADED_MODULES.get(project) ?? {};
      loaded[service] = resolved;
      LOADED_MODULES.set(service, loaded);
    } catch (error) {
      // Init errors at this level are considered blocking.
      // Doubling up on errors to be extra noisy for now, might back off to single later
      logger.fatal({ error, name: context }, `Initialization error`);
      // eslint-disable-next-line no-console
      console.log(error);
      setImmediate(() => out.FailFast());
    }
  }

  ZCC.loader = GlobalLoader;
  const out = {
    ContextLoader,
    FailFast: () => exit(),
    GlobalLoader,
    Insert,
  };
  return out;
}
