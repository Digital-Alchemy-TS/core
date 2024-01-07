import { is, ZCC } from "@zcc/utilities";

import {
  ModuleConfiguration,
  OptionalModuleConfiguration,
} from "./configuration.extension.mjs";

type LibraryConfigurationOptions = {
  library: string;
  configuration?: OptionalModuleConfiguration;
};

export function CreateLibraryModule({
  library,
  configuration,
}: LibraryConfigurationOptions) {
  const lifecycle = ZCC.lifecycle.child();
  const logger = ZCC.logger.context(`${library}:Bootstrap`);

  if (!is.empty(configuration)) {
    lifecycle.onRegister(() => {
      // console.log("HIT");
      logger.debug("Merge library configurations");
      ZCC.config.addLibraryDefinition(
        library,
        configuration as ModuleConfiguration,
      );
    });
  }
  return {
    childLogger: (context: string) =>
      ZCC.logger.context(`${library}:${context}`),
    configuration,
    getConfig: <T,>(property: string): T => ZCC.config.get([library, property]),
    lifecycle,
    name: library,
  };
}

export type LibraryDefinition = ReturnType<typeof CreateLibraryModule>;
