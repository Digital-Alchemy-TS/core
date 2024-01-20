import {
  DOWN,
  each,
  eachSeries,
  is,
  UP,
  ZCC,
  ZCC_Testing,
} from "@zcc/utilities";
import { EventEmitter } from "eventemitter3";
import { exit } from "process";

import {
  BOILERPLATE_LIB_NAME,
  LIB_BOILERPLATE_CONFIGURATION,
} from "../helpers/config.constants.mjs";
import { BootstrapException } from "../helpers/errors.helper.mjs";
import {
  ZCC_APPLICATION_ERROR,
  ZCC_LIBRARY_ERROR,
} from "../helpers/events.helper.mjs";
import {
  CallbackList,
  LIFECYCLE_STAGES,
  LifecycleCallback,
  LifecycleStages,
  TLifecycleBase,
  TLoadableChildLifecycle,
} from "../helpers/lifecycle.helper.mjs";
import { ConfigurationFiles } from "../helpers/testing.helper.mjs";
import {
  ApplicationConfigurationOptions,
  BootstrapOptions,
  GetApisResult,
  LibraryConfigurationOptions,
  Loader,
  ServiceFunction,
  ServiceMap,
  TConfigurable,
  TGetConfig,
  TModuleMappings,
  TResolvedModuleMappings,
  TServiceReturn,
  ZCCApplicationDefinition,
  ZCCLibraryDefinition,
} from "../helpers/wiring.helper.mjs";
import { ZCC_Cache } from "./cache.extension.mjs";
import {
  OptionalModuleConfiguration,
  ZCC_Configuration,
} from "./configuration.extension.mjs";
import { ZCC_Fetch } from "./fetch.extension.mjs";
import { ILogger, ZCC_Logger } from "./logger.extension.mjs";

const NONE = -1;

const FILE_CONTEXT = `${BOILERPLATE_LIB_NAME}:Loader`;
type ActiveApplicationDefinition<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
> = {
  application: ZCCApplicationDefinition<S, C>;
  LOADED_MODULES: Map<string, TResolvedModuleMappings>;
  MODULE_MAPPINGS: Map<string, TModuleMappings>;
  LOADED_LIFECYCLES: Map<string, TLoadableChildLifecycle>;
  REVERSE_MODULE_MAPPING: Map<
    ServiceFunction,
    [project: string, service: string]
  >;
};

function ValidateLibrary<S extends ServiceMap>(
  project: string,
  serviceList: S,
): void | never {
  if (is.empty(project)) {
    throw new BootstrapException(
      "CreateLibrary",
      "MISSING_LIBRARY_NAME",
      "Library name is required",
    );
  }
  const services = Object.entries(serviceList);

  // Find the first invalid service
  const invalidService = services.find(
    ([, definition]) => typeof definition !== "function",
  );
  if (invalidService) {
    const [invalidServiceName, service] = invalidService;
    throw new BootstrapException(
      "CreateLibrary",
      "INVALID_SERVICE_DEFINITION",
      `Invalid service definition for '${invalidServiceName}' in library '${project}' (${typeof service})`,
    );
  }
}
//
// "Semi local variables"
// These are resettable variables, which are scoped to outside the function on purpose
// If these were moved inside the service function, then re-running the method would result in application / library references being stranded
// Items like lib_boilerplate would still exist, but their lifecycles would be not accessible by the current application
//
// By moving to outside the function, the internal methods will be able to re-initialize as expected, without needing to fully rebuild every reference everywhere
// ... in theory
//

let completedLifecycleCallbacks = new Set<string>();
/**
 * association of projects to { service : Declaration Function }
 */
let MODULE_MAPPINGS = new Map<string, TModuleMappings>();
/**
 * association of projects to { service : Initialized Service }
 */
let LOADED_MODULES = new Map<string, TResolvedModuleMappings>();
/**
 * Optimized reverse lookups: Declaration  Function => [project, service]
 */
let REVERSE_MODULE_MAPPING = new Map<
  ServiceFunction,
  [project: string, service: string]
>();

let LOADED_LIFECYCLES = new Map<string, TLoadableChildLifecycle>();

/**
 * Details relating to the application that is actively running
 */
let ACTIVE_APPLICATION: ActiveApplicationDefinition<
  ServiceMap,
  OptionalModuleConfiguration
> = undefined;

// heisenberg's logger. it's probably here, but maybe not
let logger: ILogger;

const processEvents = new Map([
  [
    "SIGTERM",
    async () => {
      await Teardown();
      await ZCC_Testing.FailFast();
    },
  ],
  [
    "SIGINT",
    async () => {
      await Teardown();
      await ZCC_Testing.FailFast();
    },
  ],
  // ["uncaughtException", () => {}],
  // ["unhandledRejection", (reason, promise) => {}],
]);

//
// Module Creation
//

const getAppConfig = (property: string) => {
  return ZCC.config.get(["application", property]);
};
export function CreateLibrary<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>({
  name: libraryName,
  configuration,
  services,
}: LibraryConfigurationOptions<S, C>): ZCCLibraryDefinition<S, C> {
  ValidateLibrary(libraryName, services);

  const lifecycle = CreateChildLifecycle();

  const getConfig = (property: string) => {
    return ZCC.config.get([libraryName, property]);
  };

  const library = {
    configuration,
    getConfig: getConfig as TGetConfig,
    lifecycle,
    name: libraryName,
    onError: callback => ZCC.event.on(ZCC_LIBRARY_ERROR(libraryName), callback),
    services,
    wire: async () => {
      LOADED_LIFECYCLES.set(libraryName, lifecycle);
      await eachSeries(
        Object.entries(services),
        async ([service, definition]) => {
          await WireService(libraryName, service, definition, lifecycle);
        },
      );
      // mental note: people should probably do all their lifecycle attachments at the base level function
      // otherwise, it'll happen after this wire() call, and go into a black hole (worst case) or fatal error ("best" case)
      return lifecycle;
    },
  } as ZCCLibraryDefinition<S, C>;
  return library;
}

export function CreateApplication<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>({
  // you should really define your own tho. using this is just lazy
  name = "zcc",
  services,
  libraries = [],
  configuration = {} as C,
}: ApplicationConfigurationOptions<S, C>) {
  const lifecycle = CreateChildLifecycle();
  const out = {
    bootstrap: async options => await Bootstrap(out, options),
    configuration,
    getConfig: getAppConfig as TGetConfig,
    libraries,
    lifecycle,
    name,
    onError: callback => ZCC.event.on(ZCC_APPLICATION_ERROR, callback),
    services,
    teardown: async () => await Teardown(),
    wire: async () => {
      LOADED_LIFECYCLES.set("application", lifecycle);
      await eachSeries(
        Object.entries(services),
        async ([service, definition]) => {
          await WireService("application", service, definition, lifecycle);
        },
      );
      return lifecycle;
    },
  } as ZCCApplicationDefinition<S, C>;
  return out;
}

const API_CACHE = new Map<
  | ZCCLibraryDefinition<ServiceMap, OptionalModuleConfiguration>
  | ZCCApplicationDefinition<ServiceMap, OptionalModuleConfiguration>,
  GetApisResult<ServiceMap>
>();

//
// Wiring
//
async function WireService(
  project: string,
  service: string,
  definition: ServiceFunction,
  lifecycle: TLifecycleBase,
) {
  // logger.trace(`Inserting %s#%s`, project, service);
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
  const context = `${project}:${service}`;
  const loader = ContextLoader(project) as Loader<TConfigurable>;

  // logger gets defined first, so this really is only for the start of the start of bootstrapping
  const logger = ZCC.logger ? ZCC.logger.context(context) : undefined;

  try {
    logger?.trace(`Initializing`);
    const resolved = await definition({
      cache: ZCC.cache,
      context,
      event: ZCC.event,
      getApis: <S extends ServiceMap>(
        project:
          | ZCCLibraryDefinition<S, OptionalModuleConfiguration>
          | ZCCApplicationDefinition<S, OptionalModuleConfiguration>,
      ): GetApisResult<S> => {
        const cached = API_CACHE.get(project);
        if (cached) {
          return cached as GetApisResult<S>;
        }
        const generated = Object.fromEntries(
          Object.keys(project.services).map(key => [key, loader(key)]),
        ) as GetApisResult<S>;
        API_CACHE.set(project, generated);
        return generated;
      },
      lifecycle,
      logger,
    });
    REVERSE_MODULE_MAPPING.set(definition, [project, service]);
    const loaded = LOADED_MODULES.get(project) ?? {};
    loaded[service] = resolved as TServiceReturn;
    LOADED_MODULES.set(service, loaded);
  } catch (error) {
    // Init errors at this level are considered blocking.
    // Doubling up on errors to be extra noisy for now, might back off to single later
    logger?.fatal({ error, name: context }, `Initialization error`);
    // eslint-disable-next-line no-console
    console.log(error);
    ZCC_Testing.FailFast();
  }
}

async function RunStageCallbacks(stage: LifecycleStages) {
  // logger.trace(`Running %s callbacks`, stage.toLowerCase());
  completedLifecycleCallbacks.add(`on${stage}`);

  const list = [
    // boilerplate priority
    LOADED_LIFECYCLES.get(BOILERPLATE_LIB_NAME).getCallbacks(stage),
    // children next
    // ...
    ...[...LOADED_LIFECYCLES.entries()]
      .filter(([name]) => ![BOILERPLATE_LIB_NAME, "application"].includes(name))
      .map(([, thing]) => thing.getCallbacks(stage)),
    // finally app
    LOADED_LIFECYCLES.get("application")?.getCallbacks(stage),
  ];
  await eachSeries(list, async callbacks => {
    if (is.empty(callbacks)) {
      return;
    }
    const sorted = callbacks.filter(([, sort]) => sort !== NONE);
    const quick = callbacks.filter(([, sort]) => sort === NONE);
    await eachSeries(
      sorted.sort(([, a], [, b]) => (a > b ? UP : DOWN)),
      async ([callback]) => await callback(),
    );
    await each(quick, async ([callback]) => await callback());
  });
}

//
// Lifecycle runners
//
async function Bootstrap<
  S extends ServiceMap,
  C extends OptionalModuleConfiguration,
>(application: ZCCApplicationDefinition<S, C>, options: BootstrapOptions) {
  if (ACTIVE_APPLICATION) {
    throw new BootstrapException(
      "wiring.extension",
      "NO_DUAL_BOOT",
      "Another application is already active, please terminate",
    );
  }
  try {
    ZCC.event = new EventEmitter();

    ZCC.application = ACTIVE_APPLICATION = {
      LOADED_LIFECYCLES,
      LOADED_MODULES,
      MODULE_MAPPINGS,
      REVERSE_MODULE_MAPPING,
      application,
    };

    const boilerplate = CreateLibrary({
      configuration: LIB_BOILERPLATE_CONFIGURATION,
      name: BOILERPLATE_LIB_NAME,
      services: {
        cache: ZCC_Cache,
        configuration: ZCC_Configuration,
        fetch: ZCC_Fetch,
        logger: ZCC_Logger,
      },
    });
    await boilerplate.wire();
    if (!is.empty(options?.configuration)) {
      ZCC.config.merge(options?.configuration);
    }
    // logger = ZCC.logger.context(`${BOILERPLATE_LIB_NAME}:wiring`);
    processEvents.forEach((callback, event) => process.on(event, callback));

    application.libraries ??= [];
    await eachSeries(application.libraries, async i => await i.wire());
    await application.wire();

    await RunStageCallbacks("PreInit");
    await ZCC.config.loadConfig(application);
    await RunStageCallbacks("PostConfig");
    await RunStageCallbacks("Bootstrap");
    await RunStageCallbacks("Ready");
  } catch (error) {
    // logger.fatal({ application, error }, "Bootstrap failed");
    // eslint-disable-next-line no-console
    console.error(error);
    // await Teardown();
    ZCC_Testing.FailFast();
  }
}

async function Teardown() {
  if (!ACTIVE_APPLICATION) {
    return;
  }
  ACTIVE_APPLICATION = undefined;
  completedLifecycleCallbacks = new Set<string>();
  processEvents.forEach((callback, event) =>
    process.removeListener(event, callback),
  );
  // logger.info(`teardown complete`);
  // logger = undefined;
}

//
// Loaders
//
function ContextLoader(project: string) {
  return (service: string | ServiceFunction): TServiceReturn => {
    if (!is.string(service)) {
      const pair = REVERSE_MODULE_MAPPING.get(service);
      service = pair.pop();
    }
    return LOADED_MODULES.get(project)[service];
  };
}

//
// Lifecycle
//
function CreateChildLifecycle(name?: string): TLoadableChildLifecycle {
  const stages = [...LIFECYCLE_STAGES];
  const childCallbacks = Object.fromEntries(stages.map(i => [i, []])) as Record<
    LifecycleStages,
    CallbackList
  >;

  const [
    onPreInit,
    onPostConfig,
    onBootstrap,
    onReady,
    onShutdownStart,
    onShutdownComplete,
  ] = LIFECYCLE_STAGES.map(
    stage =>
      (callback: LifecycleCallback, priority = NONE) => {
        if (completedLifecycleCallbacks.has(`on${stage}`)) {
          logger.fatal(`[on${stage}] late attach, cannot attach callback`);
          ZCC_Testing.FailFast();
          return;
        }
        childCallbacks[stage].push([callback, priority]);
      },
  );

  const lifecycle = {
    getCallbacks: stage => childCallbacks[stage] as CallbackList,
    onBootstrap,
    onPostConfig,
    onPreInit,
    onReady,
    onShutdownComplete,
    onShutdownStart,
  };
  if (!is.empty(name)) {
    LOADED_LIFECYCLES.set(name, lifecycle);
  }
  return lifecycle;
}

//
// Final Attachments!
//
ZCC.bootstrap = Bootstrap;
ZCC.createApplication = CreateApplication;
ZCC.createLibrary = CreateLibrary;
ZCC.teardown = Teardown;
ZCC.lifecycle = CreateChildLifecycle;

ZCC_Testing.configurationFiles = ConfigurationFiles;
ZCC_Testing.FailFast = (): void => exit();
ZCC_Testing.LOADED_MODULES = () => LOADED_MODULES;
ZCC_Testing.MODULE_MAPPINGS = () => MODULE_MAPPINGS;
ZCC_Testing.REVERSE_MODULE_MAPPING = () => REVERSE_MODULE_MAPPING;
ZCC_Testing.WiringReset = () => {
  process.removeAllListeners();
  MODULE_MAPPINGS = new Map();
  LOADED_MODULES = new Map();
  LOADED_LIFECYCLES = new Map();
  REVERSE_MODULE_MAPPING = new Map();
  completedLifecycleCallbacks = new Set<string>();
  ACTIVE_APPLICATION = undefined;
};
ZCC_Testing.WireService = WireService;

declare module "@zcc/utilities" {
  export interface ZCCTestingDefinition {
    // void for unit testing, never for reality
    FailFast: () => void;
    Teardown: typeof Teardown;
    /**
     * exported helpers for unit testing, no use to applications
     */
    LOADED_MODULES: () => typeof LOADED_MODULES;
    MODULE_MAPPINGS: () => typeof MODULE_MAPPINGS;
    REVERSE_MODULE_MAPPING: () => typeof REVERSE_MODULE_MAPPING;
    WiringReset: () => void;
    WireService: typeof WireService;
  }
}

// Type definitions for global ZCC attachments
declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    application:
      | ActiveApplicationDefinition<ServiceMap, OptionalModuleConfiguration>
      | undefined;
    bootstrap: <S extends ServiceMap, C extends OptionalModuleConfiguration>(
      application: ZCCApplicationDefinition<S, C>,
      options: BootstrapOptions,
    ) => Promise<void>;
    createApplication: <
      S extends ServiceMap,
      C extends OptionalModuleConfiguration,
    >(
      options: ApplicationConfigurationOptions<S, C>,
    ) => ZCCApplicationDefinition<S, C>;
    createLibrary: <
      S extends ServiceMap,
      C extends OptionalModuleConfiguration,
    >(
      options: LibraryConfigurationOptions<S, C>,
    ) => ZCCLibraryDefinition<S, C>;
    // the mismatched required state (with the implementation) of name is on purpose
    // external consumers of this should be passing names, and operate as if they will definitely want to wire their logic in
    // they lack access to the variables for the conditional loading workflows
    lifecycle: (name: string) => TLifecycleBase;
    teardown: () => Promise<void>;
  }
}
