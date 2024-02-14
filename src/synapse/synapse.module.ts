import { CreateLibrary } from "../boilerplate";
import {
  BinarySensor,
  Button,
  Registry,
  Scene,
  Sensor,
  Switch,
} from "./extensions";

export const LIB_SYNAPSE = CreateLibrary({
  configuration: {
    ANNOUNCE_AT_BOOT: {
      default: false,
      description: [
        "Emit the entity list update every time this application is booted",
        "zcc.reload() service available for manual reload",
      ],
      type: "boolean",
    },
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
  },
  name: "synapse",
  priorityInit: ["registry"],
  services: {
    binary_sensor: BinarySensor,
    button: Button,
    registry: Registry,
    scene: Scene,
    sensor: Sensor,
    switch: Switch,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    synapse: typeof LIB_SYNAPSE;
  }
}
