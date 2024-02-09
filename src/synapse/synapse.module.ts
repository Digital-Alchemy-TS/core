import { CreateLibrary } from "../boilerplate";
import { BinarySensor, Button, Registry, Sensor, Switch } from "./extensions";

export const LIB_SYNAPSE = CreateLibrary({
  configuration: {
    APPLICATION_IDENTIFIER: {
      description: [
        "Used to generate unique ids in home assistant",
        "Defaults to application name",
      ],
      type: "string",
    },
    EMIT_HEARTBEAT: {
      default: true,
      description: ["Emit a pulse so the extension knows the service is alive"],
      type: "boolean",
    },
    // REPEAT_VALUE: {
    //   default: 5 * MINUTE,
    //   description: [
    //     "How often to re-send values to home assistant",
    //     "Set to 0 or -1 to disable functionality",
    //   ],
    //   type: "number",
    // },
  },
  name: "synapse",
  services: {
    binary_sensor: BinarySensor,
    button: Button,
    registry: Registry,
    sensor: Sensor,
    switch: Switch,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    synapse: typeof LIB_SYNAPSE;
  }
}
