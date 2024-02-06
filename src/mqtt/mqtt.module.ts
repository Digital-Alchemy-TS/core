import { IClientOptions } from "mqtt";

import { CreateLibrary } from "../boilerplate";
import { MQTT_Bindings } from ".";

export const LIB_MQTT = CreateLibrary({
  configuration: {
    CLIENT_OPTIONS: {
      default: {
        host: "localhost",
        password: undefined,
        port: 1883,
      } as IClientOptions,
      description: "See IClientOptions in mqtt npm package",
      type: "internal",
    },
  },
  name: "mqtt",
  services: {
    bindings: MQTT_Bindings,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    mqtt: typeof LIB_MQTT;
  }
}
