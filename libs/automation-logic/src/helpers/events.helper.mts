import { PICK_ENTITY } from "@zcc/home-assistant";
import { TContext } from "@zcc/utilities";

export const LOCATION_UPDATED = "LOCATION_UPDATED";

export const SCENE_CHANGE = <T extends string = string>(room: T) =>
  `SCENE_CHANGE:${room}`;
export const SCENE_SET_ENTITY = "SCENE_SET_ENTITY";
export const ANIMATION_INTERRUPT = "ANIMATION_INTERRUPT";
export const DETERMINISTIC_SWITCH_CHANGED = "DETERMINISTIC_SWITCH_CHANGED";
export type DeterministicSwitchChangedData = {
  entity_id: PICK_ENTITY<"switch"> | PICK_ENTITY<"switch">[];
  state: "on" | "off";
};

export const AGGRESSIVE_SCENES_ADJUSTMENT = "AGGRESSIVE_SCENES_ADJUSTMENT";
export type AggressiveScenesAdjustmentTypes =
  | "light_brightness"
  | "light_color"
  | "light_temperature"
  | "light_on_off"
  | "switch_on_off";
export type AggressiveScenesAdjustmentData = {
  entity_id: PICK_ENTITY<"switch" | "light">;
  type: AggressiveScenesAdjustmentTypes;
};

export const ROOM_SET_SCENE = "ROOM_SET_SCENE";
export type RoomSetSceneData = {
  room: string;
  scene: string;
};

export const SEQUENCE_WATCHER_TRIGGER = "SEQUENCE_WATCHER_TRIGGER";
export type SequenceWatcherTriggerData = {
  context: TContext;
  label?: string;
  time: number;
};

export const SOLAR_EVENT_TRIGGER = "SOLAR_EVENT_TRIGGER";
export type SolarEventTriggerData = {
  context: TContext;
  event: string;
};
