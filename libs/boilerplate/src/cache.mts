import { ZCC } from "@zcc/utilities";

function ApplicationCache() {
  return {
    //
  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    cache: ReturnType<typeof ApplicationCache>;
  }
}

ZCC.cache = ApplicationCache();
