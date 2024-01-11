import { ZCC } from "@zcc/utilities";

import {
  ModuleConfiguration,
  OptionalModuleConfiguration,
} from "./configuration.extension.mjs";
import { LibraryDefinition } from "./library.extension.mjs";
import { TServiceDefinition, TServiceParams } from "./loader.extension.mjs";

export const LOADED_LIBRARIES = new Set<LibraryDefinition>();
type ServiceListing = Array<[name: string, loader: TServiceDefinition]>;

type ApplicationConfigurationOptions = {
  application?: string;
  services?: ServiceListing;
  libraries?: LibraryDefinition[];
  configuration?: OptionalModuleConfiguration;
};

// outer loader loader
export function ZCCCreateApplication({ logger, lifecycle }: TServiceParams) {
  // actual attachment function
  const createApplication = ({
    // you should really define your own tho. using this is just lazy
    application = "zcc",
    services = [],
    libraries = [],
    configuration = {},
  }: ApplicationConfigurationOptions) => {
    ZCC.config.setApplicationDefinition(configuration as ModuleConfiguration);

    return {
      configuration,
      getConfig: <T,>(property: string): T =>
        ZCC.config.get(["application", property]),
      // no mutating my arrays!
      getLibraries: () => [...libraries],
      getServiceList: () => [...services],
      lifecycle,
      logger,
      name: application as string,
    };
  };
  ZCC.createApplication = createApplication;
  return createApplication;
}

export type ZCCApplicationDefinition = ReturnType<
  ReturnType<typeof ZCCCreateApplication>
>;
