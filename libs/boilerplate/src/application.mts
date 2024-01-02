import { ZCC } from "@zcc/utilities";

import { AnyConfig } from "./configuration.mjs";

const DEFAULT_APPLICATION = "zcc";

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
  ZCC.application = options.application || DEFAULT_APPLICATION;
  return {
    ...options,
    configuration: {},
    lifecycle: {},
    logger: {},
  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    application: string;
    createApplication: typeof CreateApplication;
  }
}

ZCC.createApplication = CreateApplication;
ZCC.application = DEFAULT_APPLICATION;
