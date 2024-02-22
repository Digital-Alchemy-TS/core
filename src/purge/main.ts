#!/usr/bin/env node
import { CreateApplication } from "..";
import { LIB_HASS } from "../hass";
import { Purge } from "./purge.extension";

export const PURGE_APP = CreateApplication({
  configuration: {
    CANCEL_TIMEOUT: {
      default: 20,
      description: "How long to wait before running purge",
      type: "number",
    },
    EXCLUDE_ENTITIES: {
      default: [],
      description: "Omit these entities from the removal",
      type: "string[]",
    },
    LIST_PLATFORMS: {
      default: false,
      description: "List platforms and exit",
      type: "boolean",
    },
    PLATFORM: {
      description: "Home assistant integration platform",
      type: "string",
    },
    PURGE_RATE: {
      default: 5,
      type: "number",
    },
  },
  libraries: [LIB_HASS],
  name: "purge",
  services: { purge: Purge },
});
setImmediate(async () => {
  await PURGE_APP.bootstrap({
    configuration: {
      boilerplate: {
        LOG_LEVEL: "info",
      },
      hass: {
        AUTO_SCAN_CALL_PROXY: false,
      },
    },
  });
});

declare module "../boilerplate" {
  export interface LoadedModules {
    purge: typeof PURGE_APP;
  }
}
