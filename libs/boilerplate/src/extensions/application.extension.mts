import { ZCC } from "@zcc/utilities";

import { TChildLifecycle } from "../helpers/lifecycle.helper.mjs";
import {
  ModuleConfiguration,
  OptionalModuleConfiguration,
} from "./configuration.extension.mjs";
import { LibraryDefinition } from "./library.extension.mjs";
import { ILogger } from "./logger.extension.mjs";

export const LOADED_LIBRARIES = new Set<LibraryDefinition>();

type ApplicationConfigurationOptions = {
  application?: string;
  configuration?: OptionalModuleConfiguration;
};

export function CreateApplication({
  application = "zcc",
  configuration = {},
}: ApplicationConfigurationOptions): ZCCApplicationDefinition {
  const logger = ZCC.logger.context(`${application}:Bootstrap`);
  const lifecycle = ZCC.lifecycle.child();

  ZCC.config.setApplicationDefinition(configuration as ModuleConfiguration);
  lifecycle.onRegister(() => {
    console.log("HIT");
    logger.debug("Attaching library lifecycles");
    LOADED_LIBRARIES.forEach(item => {
      logger.trace({ name: item.name }, `Attach`);
      item.lifecycle.register();
    });
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
