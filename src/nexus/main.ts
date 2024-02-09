import { CreateApplication } from "..";
import { LIB_HASS } from "../hass";
import { LIB_SERVER } from "../server";
import { LIB_SYNAPSE } from "../synapse";
import { EntitiesExtension } from "./entities.extension";

export const NEXUS_APP = CreateApplication({
  libraries: [LIB_SERVER, LIB_HASS, LIB_SYNAPSE],
  name: "nexus",
  services: {
    entities: EntitiesExtension,
  },
});

declare module ".." {
  export interface LoadedModules {
    nexus: typeof NEXUS_APP;
  }
}

setImmediate(async () => {
  await NEXUS_APP.bootstrap({
    configuration: {
      boilerplate: {
        LOG_LEVEL: "trace",
      },
      hass: {
        CALL_PROXY_AUTO_SCAN: false,
        SOCKET_AUTO_CONNECT: false,
      },
      server: {
        PORT: 3001,
      },
    },
  });
});
