import { ZCC } from "@zcc/utilities";

import { CreateConfiguration } from "../extensions/configuration.extension.mjs";
import { CreateFetcher } from "../extensions/fetch.extension.mjs";
import { ILogger, ZCCLogger } from "../extensions/logger.extension.mjs";

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    config: ReturnType<typeof CreateConfiguration>;
    createFetcher: typeof CreateFetcher;
    fetch: ReturnType<typeof CreateFetcher>;
    logger: ReturnType<typeof ZCCLogger>;
    systemLogger: ILogger;
  }
}

/**
 * Order matters!
 */
export function MergeDefinitions() {
  ZCC.config = CreateConfiguration();
  ZCC.createFetcher = CreateFetcher;

  ZCC.fetch = CreateFetcher({
    logContext: "ZCC:fetch",
  });
}
