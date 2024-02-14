import { CreateLibrary } from "../boilerplate";
import {
  AggressiveScenes,
  CircadianLighting,
  LightManager,
  ManagedSwitch,
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
    light: LightManager,
    managed_switch: ManagedSwitch,
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
