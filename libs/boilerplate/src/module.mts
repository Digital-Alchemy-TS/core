import { ZCC } from "@zcc/utilities";

import { AnyConfig } from "./types/configuration.mjs";

type LibraryConfigurationOptions = {
  name: string;
  configuration: Record<string, AnyConfig>;
};

export type ZCCModuleDefinition = LibraryConfigurationOptions & {
  configuration: {};
  lifecycle: {};
  logger: {};
};

function CreateLibraryModule(
  options: LibraryConfigurationOptions,
): ZCCModuleDefinition {
  return {
    ...options,
    configuration: {},
    lifecycle: {},
    logger: {},
  };
}

declare module "@zcc/utilities" {
  export interface ZCC_Definition {
    library: typeof CreateLibraryModule;
  }
}

ZCC.library = CreateLibraryModule;
