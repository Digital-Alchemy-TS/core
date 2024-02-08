import { CreateLibrary } from "../boilerplate";
import { MINUTE } from "../utilities";
import {
  BinarySensor,
  Button,
  HttpExtension,
  Sensor,
  Switch,
} from "./extensions";

export const LIB_SYNAPSE = CreateLibrary({
  configuration: {
    ADMIN_KEY: {
      description: "Used to authenticate webhooks in Home Assistant",
      type: "string",
    },
    APPLICATION_IDENTIFIER: {
      description: [
        "Used to generate unique ids in home assistant",
        "Defaults to application name",
      ],
      type: "string",
    },
    REPEAT_VALUE: {
      default: 5 * MINUTE,
      description: [
        "How often to re-send values to home assistant",
        "Set to 0 or -1 to disable functionality",
      ],
      type: "number",
    },
    WEBHOOK_ID: {
      description: [
        "Set the webhook id in home assistant",
        "Default value: {config.synapse.APPLICATION_IDENTIFIER}_zcc_webhook",
      ],
      type: "string",
    },
  },
  name: "synapse",
  services: {
    binary_sensor: BinarySensor,
    button: Button,
    http: HttpExtension,
    sensor: Sensor,
    switch: Switch,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    synapse: typeof LIB_SYNAPSE;
  }
}
