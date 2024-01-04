import { ZCC } from "@zcc/utilities";

import {
  CreateApplication,
  ImportLibrary,
  ZCCApplicationDefinition,
} from "../extensions/application.extension.mjs";
import { CreateConfiguration } from "../extensions/configuration.extension.mjs";
import { CreateFetcher } from "../extensions/fetch.extension.mjs";
import { CreateLibraryModule } from "../extensions/library.extension.mjs";
import { CreateLifecycle } from "../extensions/lifecycle.extension.mjs";
import { augmentLogger, ILogger } from "../extensions/logger.extension.mjs";

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    application: ZCCApplicationDefinition | undefined;
    config: ReturnType<typeof CreateConfiguration>;
    createApplication: typeof CreateApplication;
    createFetcher: typeof CreateFetcher;
    createLibrary: typeof CreateLibraryModule;
    fetch: ReturnType<typeof CreateFetcher>;
    importLibrary: typeof ImportLibrary;
    lifecycle: ReturnType<typeof CreateLifecycle>;
    logger: ReturnType<typeof augmentLogger>;
    systemLogger: ILogger;
  }
}

/**
 * Order matters!
 */
export function MergeDefinitions() {
  ZCC.logger = augmentLogger();
  ZCC.config = CreateConfiguration();
  ZCC.systemLogger = ZCC.logger.context("ZCC:system");
  ZCC.createApplication = CreateApplication;
  ZCC.createFetcher = CreateFetcher;
  ZCC.createLibrary = CreateLibraryModule;
  ZCC.importLibrary = ImportLibrary;
  ZCC.lifecycle = CreateLifecycle();

  ZCC.fetch = CreateFetcher({
    logContext: "ZCC:fetch",
  });
}
