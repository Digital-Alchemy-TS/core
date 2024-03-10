import { CreateLibrary } from "../boilerplate";
import { LIB_HASS } from "../hass";
import { LIB_SYNAPSE } from "../synapse";
import {
  AggressiveScenes,
  CircadianLighting,
  LightManager,
  ManagedSwitch,
  Room,
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
    CIRCADIAN_DIFF_THRESHOLD: {
      default: 50,
      description:
        "Current light temperature must be at least this much off target in order to be eligible for adjustment",
      type: "number",
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
    CIRCADIAN_RATE: {
      default: 3,
      description: [
        "Number of entities to adjust at the same time",
        "Higher values increase load",
      ],
      type: "number",
    },
    CIRCADIAN_SENSOR_NAME: {
      default: "Light temperature",
      description: "Sensor for reading / writing current light temperature to",
      type: "string",
    },
    CIRCADIAN_THROTTLE: {
      default: 300,
      description: "Artificial delay to add",
      type: "number",
    },
    SEQUENCE_TIMEOUT: {
      default: 1500,
      description:
        "When tracking state changes for a sequence event, another change must happen inside this time window",
      type: "number",
    },
  },
  depends: [LIB_HASS, LIB_SYNAPSE],
  name: "automation",
  // light depends circadian
  priorityInit: ["circadian"],
  services: {
    /**
     * # Aggressive Scenes extension
     *
     * Sets up opt-in functionality that allows for more active management of scene states inside the system
     * It coordinates with rooms to know what the current state is, and periodically checks entities to ensure that are currently in the state that they are expected to be
     *
     * - Correct for changes made in the real world (humans turning on a switch that should be off at the moment)
     * - Changing definitions of "correct" (like light colors for circadian lighting)
     * - Entities that failed to change to the correct state when asked the first time
     */
    aggressive: AggressiveScenes,
    /**
     * # Circadian lighting
     *
     * Generate an entity to maintain the current color temperature target for lights
     */
    circadian: CircadianLighting,
    /**
     * Internal tools for managing lights
     */
    light: LightManager,
    /**
     * adjust the state of a switch, based on a calculated state
     */
    managed_switch: ManagedSwitch,
    /**
     * Coordinate a set of entities as a higher level group
     *
     * Creates scenes, and sensors
     */
    room: Room,
    /**
     * match a sequence of events to trigger callback
     */
    sequence: SequenceWatcher,
    /**
     * tools for performing logic with sun position
     */
    solar: SolarCalculator,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    /**
     * higher level automation tools
     */
    automation: typeof LIB_AUTOMATION;
  }
}
