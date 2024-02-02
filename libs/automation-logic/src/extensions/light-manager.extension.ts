import { TServiceParams } from "@zcc/boilerplate";
import {
  ENTITY_STATE,
  LIB_HOME_ASSISTANT,
  PICK_ENTITY,
} from "@zcc/hass";
import { each, is, NONE } from "@zcc/utilities";

import {
  AggressiveScenesAdjustmentTypes,
  LIB_AUTOMATION_LOGIC,
  SceneDefinition,
  SceneLightState,
  SceneLightStateOn,
} from "../index";
import { ColorLight } from "./circadian.extension";

const MAX_DIFFERENCE = 100;

export function LightManager({ logger, getApis, lifecycle }: TServiceParams) {
  let minTemperature: number;
  let maxTemperature: number;
  const hass = getApis(LIB_HOME_ASSISTANT);
  const automation = getApis(LIB_AUTOMATION_LOGIC);

  lifecycle.onPostConfig(() => {
    minTemperature = LIB_AUTOMATION_LOGIC.getConfig("CIRCADIAN_MIN_TEMP");
    maxTemperature = LIB_AUTOMATION_LOGIC.getConfig("CIRCADIAN_MAX_TEMP");
  });

  /**
   * Lights fall into one of the following:
   *
   * ### Unable to change color, only brightness
   *
   * Lights will be maintained at the correct brightness / state
   *
   * ### Able to change color temp (only)
   *
   * Lights will be maintained at the correct brightness & circadian color temp
   *
   * ### RGB (only)
   *
   * Will always manage brightness & state.
   * If rgb color is passed, that will be used.
   * Otherwise, a conversion between color temp and rgb color is done within Home Assistant to attempt to track circadian color temp
   *
   * ### Anything goes
   *
   * Same as RGB only, but will preferentially use color temp mode
   */
  async function manageLight(
    entity: ENTITY_STATE<PICK_ENTITY<"light">>,
    scene: SceneDefinition,
  ) {
    const entity_id = entity.entity_id as PICK_ENTITY<"light">;
    const expected = scene[entity_id] as SceneLightState;
    if (is.empty(expected)) {
      // ??
      return;
    }
    if (entity.state === "unavailable") {
      logger.warn({ entity_id }, `entity is unavailable, cannot manage state`);
      return;
    }
    const performedUpdate = await matchToScene(entity, expected);
    if (performedUpdate) {
      return;
    }
    if (!is.empty(entity.attributes.entity_id)) {
      await each(entity.attributes.entity_id, async child_id => {
        const child = entity.byId(child_id);
        if (!child) {
          logger.warn(
            `%s => %s child entity of group cannot be found`,
            entity_id,
            child_id,
          );
          return;
        }
        await matchToScene(child, expected);
      });
    }
  }

  function lightInRange({ attributes }: ColorLight) {
    if (!attributes.supported_color_modes.includes("color_temp")) {
      return true;
    }
    const min = Math.max(
      minTemperature,
      attributes.min_color_temp_kelvin ?? NONE,
    );
    const max = Math.min(
      maxTemperature,
      attributes.max_color_temp_kelvin ?? NONE,
    );
    const kelvin = attributes.color_temp_kelvin;
    const target = Math.min(
      max,
      Math.max(automation.circadian.getKelvin(), min),
    );
    const difference = Math.abs(kelvin - target);

    return difference <= MAX_DIFFERENCE;
  }

  async function manageLightCircadian(
    entity: ColorLight,
    state: SceneLightStateOn,
  ): Promise<boolean> {
    const stateTests = {
      brightness: entity.attributes.brightness === state.brightness,
      state: entity.state === state.state,
      temperature: lightInRange(entity),
    };
    // ? Find things that don't currently match expectations
    const reasons = Object.keys(stateTests).filter(key => !stateTests[key]);

    let type: AggressiveScenesAdjustmentTypes;
    if (!stateTests.state) {
      type = "light_on_off";
    } else if (!stateTests.brightness) {
      type = "light_brightness";
      // eslint-disable-next-line unicorn/no-negated-condition
    } else if (!stateTests.temperature) {
      type = "light_temperature";
    } else {
      return false;
    }
    logger.debug(
      {
        from: entity.attributes.color_temp_kelvin,
        name: entity.entity_id,
        reasons,
        state,
        to: automation.circadian.getKelvin(),
      },
      `setting light {temperature}`,
    );
    // event.emit(AGGRESSIVE_SCENES_ADJUSTMENT, {
    //   entity_id: entity.entity_id,
    //   type,
    // } as AggressiveScenesAdjustmentData);
    await hass.call.light.turn_on({
      brightness: state.brightness,
      entity_id: entity.entity_id,
      kelvin: automation.circadian.getKelvin(),
    });
    return true;
  }

  /**
   * Take in the expected color state of a light, and compare against actual
   *
   * If they don't match, then issue a `turn_on` call, and log a message
   */
  async function manageLightColor(
    entity: ColorLight,
    state: SceneLightStateOn,
  ): Promise<boolean> {
    const stateTests = {
      brightness: entity.attributes.brightness == state.brightness,
      color: entity.attributes.rgb_color.every(
        (color, index) => state.rgb_color[index] === color,
      ),
      state: entity.state === "off",
    };
    // ? Find things that don't currently match expectations
    const reasons = Object.keys(stateTests).filter(key => !stateTests[key]);
    let type: AggressiveScenesAdjustmentTypes;
    if (stateTests.state) {
      type = "light_on_off";
    } else if (stateTests.brightness) {
      type = "light_brightness";
      // eslint-disable-next-line unicorn/no-negated-condition
    } else if (!stateTests.color) {
      type = "light_color";
    } else {
      return false;
    }
    // event.emit(AGGRESSIVE_SCENES_ADJUSTMENT, {
    //   entity_id: entity.entity_id,
    //   type,
    // } as AggressiveScenesAdjustmentData);
    logger.debug(
      { entity_id: entity.entity_id, reasons, rgb_color: state.rgb_color },
      `setting light color`,
    );
    await hass.call.light.turn_on({
      brightness: state.brightness,
      entity_id: entity.entity_id,
      rgb_color: state.rgb_color,
    });
    return true;
  }

  /**
   * ? return true if a change was made
   *
   * ? return false if everything is as expected
   */
  async function matchToScene(
    entity: ENTITY_STATE<PICK_ENTITY<"light">>,
    expected: SceneLightState,
  ): Promise<boolean> {
    const entity_id = entity.entity_id as PICK_ENTITY<"light">;
    if (expected.state === "off") {
      if (entity.state === "on") {
        logger.debug({ entity_id }, `on => off`);
        // event.emit(AGGRESSIVE_SCENES_ADJUSTMENT, {
        //   entity_id,
        //   type: "light_on_off",
        // } as AggressiveScenesAdjustmentData);
        await hass.call.light.turn_off({ entity_id });
        return true;
      }
      return false;
    }
    if ("rgb_color" in expected) {
      return await manageLightColor(entity as unknown as ColorLight, expected);
    }
    return await manageLightCircadian(
      entity as unknown as ColorLight,
      expected,
    );
  }

  return {
    manageLight,
  };
}
