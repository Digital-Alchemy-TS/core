import { CreateLibrary } from "../boilerplate";
import { LIB_HASS } from "../hass";
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
    ANNOUNCE_AT_CONNECT: {
      default: false,
      description: [
        "Emit the entity list update every time this application is booted",
        "digital-alchemy.reload() service available for manual reload",
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
  depends: [LIB_HASS],
  name: "synapse",
  // everything depends registry
  priorityInit: ["registry"],
  services: {
    /**
     * create `binary_sensor` domain entities
     */
    binary_sensor: BinarySensor,
    /**
     * create `button` domain entities
     *
     * run callback on activation
     */
    button: Button,
    /**
     * internal tools for managing entities
     */
    registry: Registry,
    /**
     * create `scene` domain entities
     *
     * run callback on activation
     */
    scene: Scene,
    /**
     * create `sensor` domain entities
     */
    sensor: Sensor,
    /**
     * create `switch` domain entities
     */
    switch: Switch,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    /**
     * tools for creating new entities within home assistant
     */
    synapse: typeof LIB_SYNAPSE;
  }
}
