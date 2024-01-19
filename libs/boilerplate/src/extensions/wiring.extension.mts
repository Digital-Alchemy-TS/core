import { DOWN, each, eachSeries, is, UP, ZCC } from "@zcc/utilities";
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
import {
  ApplicationConfigurationOptions,
  BootstrapOptions,
  LibraryConfigurationOptions,
  Loader,
  TModuleMappings,
  TResolvedModuleMappings,
  TServiceDefinition,
  TServiceReturn,
  ZCCApplicationDefinition,
  ZCCLibraryDefinition,
} from "../helpers/wiring.helper.mjs";
import { ZCC_Cache } from "./cache.extension.mjs";
import { ZCC_Configuration } from "./configuration.extension.mjs";
import { ZCC_Fetch } from "./fetch.extension.mjs";
import { ILogger, ZCC_Logger } from "./logger.extension.mjs";

const NONE = -1;

const FILE_CONTEXT = `${BOILERPLATE_LIB_NAME}:Loader`;
type ActiveApplicationDefinition = {
  application: ZCCApplicationDefinition;
  LOADED_MODULES: Map<string, TResolvedModuleMappings>;
  MODULE_MAPPINGS: Map<string, TModuleMappings>;
  LOADED_LIFECYCLES: Map<string, TLoadableChildLifecycle>;
  REVERSE_MODULE_MAPPING: Map<
    TServiceDefinition,
    [project: string, service: string]
  >;
};

function ValidateLibrary(
  project: string,
  services: [name: string, service: TServiceDefinition][] = [],
): void | never {
  if (is.empty(project)) {
    throw new BootstrapException(
      "CreateLibrary",
      "MISSING_LIBRARY_NAME",
      "Library name is required",
    );
  }

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
  TServiceDefinition,
  [project: string, service: string]
>();

let LOADED_LIFECYCLES = new Map<string, TLoadableChildLifecycle>();

/**
 * Details relating to the application that is actively running
 */
let ACTIVE_APPLICATION: ActiveApplicationDefinition = undefined;

// heisenberg's logger. it's probably here, but maybe not
let logger: ILogger;

const processEvents = new Map([
  [
    "SIGTERM",
    async () => {
      await Teardown();
      await TEST_WIRING.FailFast();
    },
  ],
  [
    "SIGINT",
    async () => {
      await Teardown();
      await TEST_WIRING.FailFast();
    },
  ],
  // ["uncaughtException", () => {}],
  // ["unhandledRejection", (reason, promise) => {}],
]);

//
// Module Creation
//

export function CreateLibrary({
  name: libraryName,
  configuration,
  services = [],
}: LibraryConfigurationOptions): ZCCLibraryDefinition {
  ValidateLibrary(libraryName, services);

  const lifecycle = CreateChildLifecycle();

  const library: ZCCLibraryDefinition = {
    configuration,
    getConfig: <T,>(property: string): T =>
      ZCC.config.get([libraryName, property]),
    lifecycle,
    name: libraryName,
    onError: callback => ZCC.event.on(ZCC_LIBRARY_ERROR(libraryName), callback),
    services,
    wire: async () => {
      LOADED_LIFECYCLES.set(libraryName, lifecycle);
      await eachSeries(services, async ([service, definition]) => {
        await WireService(libraryName, service, definition, lifecycle);
      });
      // mental note: people should probably do all their lifecycle attachments at the base level function
      // otherwise, it'll happen after this wire() call, and go into a black hole (worst case) or fatal error ("best" case)
      return lifecycle;
    },
  };
  return library;
}

export function CreateApplication({
  // you should really define your own tho. using this is just lazy
  name = "zcc",
  services = [],
  libraries = [],
  configuration = {},
}: ApplicationConfigurationOptions) {
  const lifecycle = CreateChildLifecycle();
  const out: ZCCApplicationDefinition = {
    bootstrap: async options => await Bootstrap(out, options),
    configuration,
    getConfig: <T,>(property: string): T =>
      ZCC.config.get(["application", property]),
    libraries,
    lifecycle,
    name,
    onError: callback => ZCC.event.on(ZCC_APPLICATION_ERROR, callback),
    services,
    teardown: async () => await Teardown(),
    wire: async () => {
      LOADED_LIFECYCLES.set("application", lifecycle);
      await eachSeries(services, async ([service, definition]) => {
        await WireService("application", service, definition, lifecycle);
      });
      return lifecycle;
    },
  };
  return out;
}

//
// Wiring
//
async function WireService(
  project: string,
  service: string,
  definition: TServiceDefinition,
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

  // const context = `${project}:${service}`;
  try {
    // logger.trace(`Initializing %s#%s`, project, service);
    const resolved = await definition({
      event: ZCC.event,
      getConfig: <T,>(
        property: string | [project: string, property: string],
      ): T =>
        ZCC.config.get(is.string(property) ? [project, property] : property),
      lifecycle,
      loader: ContextLoader(project),
      // logger gets defined first, so this really is only for the start of the start of bootstrapping
      logger: ZCC.logger
        ? ZCC.logger.context(`${project}:${service}`)
        : undefined,
    });
    REVERSE_MODULE_MAPPING.set(definition, [project, service]);
    const loaded = LOADED_MODULES.get(project) ?? {};
    loaded[service] = resolved;
    LOADED_MODULES.set(service, loaded);
  } catch (error) {
    // Init errors at this level are considered blocking.
    // Doubling up on errors to be extra noisy for now, might back off to single later
    // logger.fatal({ error, name: context }, `Initialization error`);
    // eslint-disable-next-line no-console
    console.log(error);
    TEST_WIRING.FailFast();
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
async function Bootstrap(
  application: ZCCApplicationDefinition,
  options: BootstrapOptions,
) {
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
      services: [
        ["logger", ZCC_Logger],
        ["configuration", ZCC_Configuration],
        ["cache", ZCC_Cache],
        ["fetch", ZCC_Fetch],
      ],
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
    TEST_WIRING.FailFast();
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
          TEST_WIRING.FailFast();
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
ZCC.loader = GlobalLoader;
ZCC.teardown = Teardown;
ZCC.lifecycle = CreateChildLifecycle;

/**
 * For unit testing,
 */
export const TEST_WIRING = {
  Bootstrap,
  ContextLoader,
  CreateApplication,
  // void for unit testing, never for reality
  FailFast: (): void => exit(),
  GlobalLoader,
  Lifecycle: CreateChildLifecycle,
  Teardown,
  /**
   * exported helpers for unit testing, no use to applications
   */
  testing: {
    LOADED_MODULES: () => LOADED_MODULES,
    MODULE_MAPPINGS: () => MODULE_MAPPINGS,
    REVERSE_MODULE_MAPPING: () => REVERSE_MODULE_MAPPING,
    Reset: () => {
      process.removeAllListeners();
      MODULE_MAPPINGS = new Map();
      LOADED_MODULES = new Map();
      LOADED_LIFECYCLES = new Map();
      REVERSE_MODULE_MAPPING = new Map();
      completedLifecycleCallbacks = new Set<string>();
      ACTIVE_APPLICATION = undefined;
    },
    WireService,
  },
};

// Type definitions for global ZCC attachments
declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    application: ActiveApplicationDefinition | undefined;
    bootstrap: (
      application: ZCCApplicationDefinition,
      options: BootstrapOptions,
    ) => Promise<void>;
    createApplication: (
      options: ApplicationConfigurationOptions,
    ) => ZCCApplicationDefinition;
    createLibrary: (
      options: LibraryConfigurationOptions,
    ) => ZCCLibraryDefinition;
    // the mismatched required state (with the implementation) of name is on purpose
    // external consumers of this should be passing names, and operate as if they will definitely want to wire their logic in
    // they lack access to the variables for the conditional loading workflows
    lifecycle: (name: string) => TLifecycleBase;
    loader: Loader;
    teardown: () => Promise<void>;
  }
}
