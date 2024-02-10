import { CreateLibrary } from "../boilerplate";
import {
  AggressiveScenes,
  CircadianLighting,
  LightManager,
  ManagedSwitch,
  SceneController,
  SceneRoom,
  SequenceWatcher,
  SolarCalculator,
} from "./extensions";

export const LIB_AUTOMATION = CreateLibrary({
  configuration: {
    AGGRESSIVE_SCENES: {
      default: true,
      description:
        "Verify continue to match their desired state as defined by the room's current scene",
      type: "boolean",
    },
    CIRCADIAN_ENABLED: {
      default: true,
      description:
        "Take responsibility for generating [CIRCADIAN_SENSOR] and emitting updates",
      type: "boolean",
    },
    CIRCADIAN_MAX_TEMP: {
      default: 5500,
      description:
        "Maximum color temperature for circadian lighting. Used at solar noon",
      type: "number",
    },
    CIRCADIAN_MIN_TEMP: {
      default: 2000,
      description:
        "Minimum color temperature for circadian lighting. Used while it's dark out",
      type: "number",
    },
    CIRCADIAN_SENSOR_NAME: {
      default: "Light temperature",
      description: "Sensor for reading / writing current light temperature to",
      type: "string",
    },
    DEFAULT_DIM: {
      default: 50,
      description:
        "Default amount to move light brightness by if not otherwise specified",
      type: "number",
    },
    GRADUAL_DIM_DEFAULT_INTERVAL: {
      default: 500,
      description: "Default time chunk size for gradual dim operations",
      type: "number",
    },
    MIN_BRIGHTNESS: {
      default: 5,
      description:
        "Enforce a number higher than 1 for min brightness in dimmers. Some lights do weird stuff at low numbers",
      type: "number",
    },
    MQTT_TOPIC_PREFIX: {
      default: "zcc",
      description: "Prefix to use in front of mqtt message topics",
      type: "string",
    },
    SEQUENCE_TIMEOUT: {
      default: 1500,
      description:
        "When tracking state changes for a sequence event, another change must happen inside this time window",
      type: "number",
    },
  },
  name: "automation",
  services: {
    aggressive: AggressiveScenes,
    circadian: CircadianLighting,
    controller: SceneController,
    light: LightManager,
    managedSwitch: ManagedSwitch,
    room: SceneRoom,
    sequence: SequenceWatcher,
    solar: SolarCalculator,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    automation: typeof LIB_AUTOMATION;
  }
}
