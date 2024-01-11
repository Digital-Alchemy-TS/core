import { ZCC } from "@zcc/utilities";

import {
  ZCCApplicationDefinition,
  ZCCCreateApplication,
} from "../extensions/application.extension.mjs";
import { CreateConfiguration } from "../extensions/configuration.extension.mjs";
import { CreateFetcher } from "../extensions/fetch.extension.mjs";
import { ZCCCreateLibrary } from "../extensions/library.extension.mjs";
import { Loader } from "../extensions/loader.extension.mjs";
import { ILogger, ZCCLogger } from "../extensions/logger.extension.mjs";
import { TParentLifecycle } from "./lifecycle.helper.mjs";

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    application: ZCCApplicationDefinition | undefined;
    config: ReturnType<typeof CreateConfiguration>;
    createApplication: ReturnType<typeof ZCCCreateApplication>;
    createFetcher: typeof CreateFetcher;
    createLibrary: ReturnType<typeof ZCCCreateLibrary>;
    fetch: ReturnType<typeof CreateFetcher>;
    lifecycle: TParentLifecycle;
    logger: ReturnType<typeof ZCCLogger>;
    loader: Loader;
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
