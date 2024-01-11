import { is, ZCC } from "@zcc/utilities";

import {
  ModuleConfiguration,
  OptionalModuleConfiguration,
} from "./configuration.extension.mjs";
import { TServiceDefinition, TServiceParams } from "./loader.extension.mjs";

type LibraryConfigurationOptions = {
  library: string;
  services?: Array<[name: string, loader: TServiceDefinition]>;
  configuration?: OptionalModuleConfiguration;
};

export function ZCCCreateLibrary({ logger, lifecycle }: TServiceParams) {
  const createLibrary = function ({
    library,
    configuration,
    services = [],
  }: LibraryConfigurationOptions) {
    if (!is.empty(configuration)) {
      logger.debug("Merge library configurations");
      ZCC.config.addLibraryDefinition(
        library,
        configuration as ModuleConfiguration,
      );
    }

    return {
      configuration,
      getConfig: <T,>(property: string): T =>
        ZCC.config.get([library, property]),
      // no mutating my array
      getServiceList: () => [...services],
      lifecycle,
      name: library,
      services,
    };
  };
  ZCC.createLibrary = createLibrary;
  return createLibrary;
}

export type LibraryDefinition = ReturnType<ReturnType<typeof ZCCCreateLibrary>>;
