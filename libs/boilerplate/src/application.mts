import { ZCC } from "@zcc/utilities";

import { AnyConfig } from "./configuration.mjs";

type ApplicationConfigurationOptions = {
  application?: string;
  configuration?: Record<string, AnyConfig>;
};

export type ZCCApplicationDefinition = ApplicationConfigurationOptions & {
  configuration: object;
  lifecycle: object;
  logger: object;
};

function CreateApplication(
  options: ApplicationConfigurationOptions,
): ZCCApplicationDefinition {
  return {
    ...options,
    configuration: {},
    lifecycle: {},
    logger: {},
  };
}

declare module "@zcc/utilities" {
  export interface ZCC_Definition {
    application: typeof CreateApplication;
  }
}
ZCC.application = CreateApplication;
