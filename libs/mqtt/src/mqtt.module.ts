import { ZCC } from "@zcc/utilities";
import { IClientOptions } from "mqtt";

import { MQTT_Bindings } from "./extensions";

export const LIB_MQTT = ZCC.createLibrary({
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
