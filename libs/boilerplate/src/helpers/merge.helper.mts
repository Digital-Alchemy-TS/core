import { ZCC } from "@zcc/utilities";

import { CreateFetcher } from "../extensions/fetch.extension.mjs";

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    createFetcher: typeof CreateFetcher;
    fetch: ReturnType<typeof CreateFetcher>;
  }
}

/**
 * Order matters!
 */
export function MergeDefinitions() {
  ZCC.createFetcher = CreateFetcher;

  ZCC.fetch = CreateFetcher({
    logContext: "ZCC:fetch",
  });
}
