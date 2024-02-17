import { each } from "async";

import { is, TContext, TServiceParams } from "../..";
import { domain, ENTITY_STATE, PICK_ENTITY } from "../../hass";
import {
  AGGRESSIVE_SCENES_ADJUSTMENT,
  AggressiveScenesAdjustmentData,
  RoomScene,
  SceneDefinition,
  SceneSwitchState,
} from "../helpers";

type TValidateOptions = {
  context: TContext;
  room: string;
  name: string;
  scene: RoomScene;
};

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
export function AggressiveScenes({
  logger,
  config,
  hass,
  event,
  automation,
}: TServiceParams) {
  // eslint-disable-next-line sonarjs/cognitive-complexity
  async function manageSwitch(
    entity: ENTITY_STATE<PICK_ENTITY<"switch">>,
    scene: SceneDefinition,
  ) {
    const entity_id = entity.entity_id as PICK_ENTITY<"switch">;
    const expected = scene[entity_id] as SceneSwitchState;
    if (is.empty(expected)) {
      // ??
      return;
    }
    if (entity.state === "unavailable") {
      logger.warn(
        { name: entity_id },
        `{unavailable} entity, cannot manage state`,
      );
      return;
    }
    let performedUpdate = false;
    if (entity.state !== expected.state) {
      await matchSwitchToScene(entity, expected);
      performedUpdate = true;
    }
    if (performedUpdate) {
      return;
    }

    if ("entity_id" in entity.attributes) {
      // ? This is a group
      const id = entity.attributes.entity_id;
      if (is.array(id) && !is.empty(id)) {
        await each(
          entity.attributes.entity_id as PICK_ENTITY<"switch">[],
          async child_id => {
            const child = hass.entity.byId(child_id);
            if (!child) {
              logger.warn(
                `%s => %s child entity of group cannot be found`,
                entity_id,
                child_id,
              );
              return;
            }
            if (child.state === "unavailable") {
              logger.warn(
                { name: child_id },
                `{unavailable} entity, cannot manage state`,
              );
              return;
            }
            if (child.state !== expected.state) {
              await matchSwitchToScene(child, expected);
            }
          },
        );
      }
    }
  }

  async function matchSwitchToScene(
    entity: ENTITY_STATE<PICK_ENTITY<"switch">>,
    expected: SceneSwitchState,
  ) {
    const entity_id = entity.entity_id;
    logger.debug({ name: entity_id, state: expected.state }, `changing state`);
    event.emit(AGGRESSIVE_SCENES_ADJUSTMENT, {
      entity_id,
      type: "switch_on_off",
    } as AggressiveScenesAdjustmentData);
    if (expected.state === "on") {
      await hass.call.switch.turn_on({ entity_id });
      return;
    }
    await hass.call.switch.turn_off({ entity_id });
  }

  /**
   * This function should **NOT** emit logs on noop
   *
   * - errors
   * - warnings
   * - state changes
   */
  async function validateRoomScene({
    scene,
    room,
    name,
    context,
  }: TValidateOptions): Promise<void> {
    if (
      config.automation.AGGRESSIVE_SCENES === false ||
      scene?.aggressive === false
    ) {
      // nothing to do
      return;
    }
    if (!scene?.definition) {
      logger.warn({ context, name, room, scene }, `cannot validate room scene`);
      return;
    }
    if (!is.object(scene.definition) || is.empty(scene.definition)) {
      // ? There currently is no use case for a scene with no entities in it
      // Not technically an error though
      logger.warn("no definition");
      return;
    }
    const entities = Object.keys(scene.definition) as PICK_ENTITY[];
    await each(entities, async entity_id => {
      const entity = hass.entity.byId(entity_id);
      if (!entity) {
        // * Home assistant outright does not send an entity for this id
        // The wrong id was probably input
        //
        // ? This is distinct from "unavailable" entities
        logger.error({ name: entity_id }, `cannot find entity`);
        return;
      }
      const entityDomain = domain(entity_id);
      switch (entityDomain) {
        case "light":
          await automation.light.manageLight(
            entity as ENTITY_STATE<PICK_ENTITY<"light">>,
            scene.definition,
          );
          return;
        case "switch":
          await manageSwitch(
            entity as ENTITY_STATE<PICK_ENTITY<"switch">>,
            scene.definition,
          );
          return;
        default:
          logger.debug({ name: entityDomain }, `no actions set for domain`);
      }
    });
  }

  return {
    validateRoomScene,
  };
}
