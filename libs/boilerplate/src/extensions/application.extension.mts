import { is, ZCC } from "@zcc/utilities";

import {
  ModuleConfiguration,
  OptionalModuleConfiguration,
} from "./configuration.extension.mjs";
import { LibraryDefinition } from "./library.extension.mjs";
import { TChildLifecycle } from "./lifecycle.extension.mjs";
import { ILogger } from "./logger.extension.mjs";

export const LOADED_LIBRARIES = new Set<LibraryDefinition>();

type ApplicationConfigurationOptions = {
  application?: string;
  configuration?: OptionalModuleConfiguration;
};

export function CreateApplication({
  application = "zcc",
  configuration,
}: ApplicationConfigurationOptions): ZCCApplicationDefinition {
  const logger = ZCC.logger.context(`${application}:Bootstrap`);
  const lifecycle = ZCC.lifecycle.child();
  lifecycle.onAttach(() => {
    logger.debug("Attaching library lifecycles");
    LOADED_LIBRARIES.forEach(item => {
      logger.trace({ name: item.name }, `Attach`);
      item.lifecycle.attach();
    });
    if (!is.empty(configuration)) {
      logger.debug("Merge application configuration definition");
      ZCC.config.addApplicationDefinition(configuration as ModuleConfiguration);
    }
  });
  return {
    configuration,
    lifecycle,
    logger,
    name: application as string,
  };
}

export type ZCCApplicationDefinition = {
  name: string;
  configuration: OptionalModuleConfiguration;
  lifecycle: TChildLifecycle;
  logger: ILogger;
};

export function ImportLibrary(library: LibraryDefinition) {
  ZCC.systemLogger.trace({ name: library.name }, "Import library");
  LOADED_LIBRARIES.add(library);
}
