import { ZCC } from "@zcc/utilities";

import { AnyConfig } from "./configuration.mjs";

type LibraryConfigurationOptions = {
  name: string;
  configuration: Record<string, AnyConfig>;
};

function CreateLibraryModule(options: LibraryConfigurationOptions) {
  return {
    ...options,
    config: <T,>(property: string): T =>
      ZCC.config.get([options.name, property]),
  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    library: typeof CreateLibraryModule;
  }
}

ZCC.library = CreateLibraryModule;
