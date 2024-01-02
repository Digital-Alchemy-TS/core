import { is, ZCC } from "@zcc/utilities";

import {
  ModuleConfiguration,
  OptionalModuleConfiguration,
} from "./configuration.extension.mjs";

type LibraryConfigurationOptions = {
  library: string;
  configuration?: OptionalModuleConfiguration;
};

function CreateLibraryModule({
  library,
  configuration,
}: LibraryConfigurationOptions) {
  const lifecycle = ZCC.lifecycle.child();
  const logger = ZCC.logger.context(`lib:${library}:Bootstrap`);

  if (!is.empty(configuration)) {
    lifecycle.onAttach(() => {
      logger.debug("Merge library configurations");
      ZCC.config.addLibraryDefinition(
        library,
        configuration as ModuleConfiguration,
      );
    });
  }
  return {
    configuration,
    getConfig: <T,>(property: string): T => ZCC.config.get([library, property]),
    lifecycle,
    name: library,
  };
}

export type LibraryDefinition = ReturnType<typeof CreateLibraryModule>;

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    library: typeof CreateLibraryModule;
  }
}

ZCC.library = CreateLibraryModule;
