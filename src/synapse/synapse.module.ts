import { CreateLibrary } from "../boilerplate";
import { MINUTE } from "../utilities";
import { BinarySensor, Button, Sensor, Switch } from ".";

export const LIB_SYNAPSE = CreateLibrary({
  configuration: {
    BASE_URL: {
      default: "http://192.168.1.1:7000",
      description: "Base url to use with callbacks in home assistant",
      type: "string",
    },
    HTTP_PREFIX: {
      default: "/talk-back",
      description:
        "URL prefix to use for asking home assistant to communicate back",
      type: "string",
    },
    REPEAT_VALUE: {
      default: 5 * MINUTE,
      description: "How often to re-send values to home assistant",
      type: "number",
    },
  },
  name: "synapse",
  services: {
    binary_sensor: BinarySensor,
    button: Button,
    sensor: Sensor,
    switch: Switch,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    synapse: typeof LIB_SYNAPSE;
  }
}
