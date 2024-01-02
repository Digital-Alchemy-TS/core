import { ZCC } from "@zcc/utilities";

import { AnyConfig } from "./configuration.mjs";
import { ILogger } from "./logger.mjs";

type LibraryConfigurationOptions = {
  name: string;
  configuration: Record<string, AnyConfig>;
};

export type ZCCModuleDefinition = LibraryConfigurationOptions & {
  logger: ILogger;
};

function CreateLibraryModule(
  options: LibraryConfigurationOptions,
): ZCCModuleDefinition {
  const logger = ZCC.logger.
  return {
    ...options,

  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    library: typeof CreateLibraryModule;
  }
}

ZCC.library = CreateLibraryModule;
