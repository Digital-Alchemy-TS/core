import { ALL_DOMAINS, GetDomain, PICK_ENTITY } from "@zcc/home-assistant";
import { TContext } from "@zcc/utilities";

type SceneAwareDomains = "switch" | "light";
type RGB = [r: number, g: number, b: number];

export type LightOff = {
  state: "off";
};
export type LightOn = {
  brightness?: number;
  kelvin?: number;
  rgb_color?: RGB;
  state?: "on";
};

type EntitySceneType<DOMAIN extends SceneAwareDomains> = {
  light: LightOff | LightOn;
  switch: { state: "on" | "off" };
}[DOMAIN];

export type tSceneType<ENTITY extends PICK_ENTITY<SceneAwareDomains>> =
  EntitySceneType<GetDomain<ENTITY>>;

export type tScene = {
  [key: PICK_ENTITY<SceneAwareDomains>]: tSceneType<typeof key>;
};
export type SceneDescription<RoomNames extends string = string> = {
  global: string[];
  rooms: Partial<Record<RoomNames, string[]>>;
};
export interface AutomationLogicModuleConfiguration {
  global_scenes?: Record<string, boolean>;
  room_configuration?: Record<string, RoomConfiguration>;
}

export type AllowedSceneDomains = Extract<
  ALL_DOMAINS,
  "switch" | "light" | "fan"
>;

export const SCENE_ROOM_OPTIONS = "scene-room";

export type SceneSwitchState = { state: "on" | "off" };
export type SceneLightStateOn = {
  /**
   * Light will probably restore previous value
   */
  brightness: number;
  /**
   * If not provided, light will attempt to use color temp if possible
   */
  rgb_color?: {
    b: number;
    g: number;
    r: number;
  };
  state: "on";
};
export type SceneLightState = { state: "off" } | SceneLightStateOn;

type MappedDomains = {
  light: SceneLightState;
  switch: SceneSwitchState;
};

export type SceneDefinition = {
  [entity_id: PICK_ENTITY<keyof MappedDomains>]: MappedDomains[GetDomain<
    typeof entity_id
  >];
};

export type SceneList<SCENES extends string> = Record<
  SCENES,
  Partial<Record<PICK_ENTITY<AllowedSceneDomains>, SceneDefinition>>
>;

export type RoomConfiguration<SCENES extends string> = {
  context: TContext;
  /**
   * Friendly name
   */
  name?: string;

  /**
   * Used for construction of entity ids and such
   */
  id: string;
  /**
   * Global scenes are required to be declared within the room
   */
  scenes: Record<SCENES, RoomScene>;
};

export type RoomScene = {
  /**
   * Ensure entities are maintained as the scene says they should be
   *
   * - Automatically revert changes made by pesky humans
   *   - how dare they?!
   *
   * - Ensure lights match the brightness / color the scene says they should be
   *   - sometimes things don't fully make brightness transitions, this will fix
   */
  aggressive?: {
    /**
     * default: `true` (controlled by config)
     */
    enabled?: boolean;
  };
  /**
   * Human understandable description of this scene (long form)
   */
  description?: string;
  /**
   * Human understandable description of this scene (short form)
   */
  friendly_name?: string;
  definition: Record<PICK_ENTITY<AllowedSceneDomains>, SceneDefinition>;
};