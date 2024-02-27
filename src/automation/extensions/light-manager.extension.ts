import { TServiceParams } from "../../boilerplate";
import {
  ByIdProxy,
  ENTITY_STATE,
  GenericEntityDTO,
  PICK_ENTITY,
} from "../../hass";
import {
  CronExpression,
  DOWN,
  each,
  eachLimit,
  is,
  NONE,
  sleep,
  UP,
} from "../../utilities";
import { RoomDefinition } from "..";
import {
  AggressiveScenesAdjustmentTypes,
  SceneDefinition,
  SceneLightState,
  SceneLightStateOn,
} from "../helpers";

type ColorModes = "color_temp" | "xy" | "brightness";
export type ColorLight = GenericEntityDTO<{
  brightness: number;
  color_mode: ColorModes;
  color_temp: number;
  color_temp_kelvin: number;
  entity_id?: PICK_ENTITY<"light">[];
  hs_color: [h: number, s: number];
  max_color_temp_kelvin: number;
  max_mireds: number;
  min_color_temp_kelvin: number;
  min_mireds: number;
  rgb_color: [number, number, number];
  supported_color_modes: ColorModes[];
  supported_features: number;
  xy_color: [x: number, y: number];
}>;
// const MAX_DIFFERENCE = 100;

type DiffList = {
  light: PICK_ENTITY<"light">;
  diff: number;
};

export function LightManager({
  logger,
  hass,
  scheduler,
  lifecycle,
  automation,
  config,
}: TServiceParams) {
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
    if ("entity_id" in entity.attributes) {
      const list = entity.attributes.entity_id as PICK_ENTITY<"light">[];

      if (is.array(list) && !is.empty(list)) {
        await each(list, async (child_id) => {
          const child = hass.entity.byId(child_id);
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
  }

  function getCurrentDiff({
    attributes,
  }: ColorLight | ByIdProxy<PICK_ENTITY<"light">>) {
    if (!attributes.supported_color_modes.includes("color_temp")) {
      return NONE;
    }
    const min = Math.max(
      config.automation.CIRCADIAN_MIN_TEMP,
      attributes.min_color_temp_kelvin ?? NONE,
    );
    const max = Math.min(
      config.automation.CIRCADIAN_MAX_TEMP,
      attributes.max_color_temp_kelvin ?? NONE,
    );
    const kelvin = attributes.color_temp_kelvin;
    const target = Math.min(
      max,
      Math.max(automation.circadian.getKelvin(), min),
    );
    return Math.abs(kelvin - target);
  }

  // async function manageLightCircadian(
  //   entity: ColorLight,
  //   state: SceneLightStateOn,
  // ): Promise<boolean> {
  //   const stateTests = {
  //     brightness: entity.attributes.brightness === state.brightness,
  //     state: entity.state === state.state,
  //     temperature: getCurrentDiff(entity) <= MAX_DIFFERENCE,
  //   };
  //   // ? Find things that don't currently match expectations
  //   const reasons = Object.keys(stateTests).filter(
  //     key => !stateTests[key as keyof typeof stateTests],
  //   );

  //   let type: AggressiveScenesAdjustmentTypes;
  //   if (!stateTests.state) {
  //     type = "light_on_off";
  //   } else if (!stateTests.brightness) {
  //     type = "light_brightness";
  //     // eslint-disable-next-line unicorn/no-negated-condition
  //   } else if (!stateTests.temperature) {
  //     type = "light_temperature";
  //   } else {
  //     return false;
  //   }
  //   logger.debug(
  //     {
  //       from: entity.attributes.color_temp_kelvin,
  //       name: entity.entity_id,
  //       reasons,
  //       state,
  //       to: automation.circadian.getKelvin(),
  //       type,
  //     },
  //     `setting light {temperature}`,
  //   );
  //   await hass.call.light.turn_on({
  //     brightness: state.brightness,
  //     entity_id: entity.entity_id,
  //     kelvin: automation.circadian.getKelvin(),
  //   });
  //   return true;
  // }

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
        (color: number, index: number) =>
          state.rgb_color[[..."rgb"][index] as keyof typeof state.rgb_color] ===
          color,
      ),
      state: entity.state === "off",
    };
    // ? Find things that don't currently match expectations
    const reasons = Object.keys(stateTests).filter(
      (key) => !stateTests[key as keyof typeof stateTests],
    );
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
    logger.debug(
      {
        entity_id: entity.entity_id,
        reasons,
        rgb_color: state.rgb_color,
        type,
      },
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
        await hass.call.light.turn_off({ entity_id });
        return true;
      }
      return false;
    }
    if ("rgb_color" in expected) {
      return await manageLightColor(entity as unknown as ColorLight, expected);
    }
    return true;
    // // TODO this technically overlaps with the big cron below, needs attention
    // // Something should be done about the inefficiency of 2 overlapping processes like this
    // // It could end up with multiple service calls in flight unnecessarily
    // // Each of these processes individually throttles itself fine, but when a change of scene happens
    // // it can end up with the light rapidly changing and sticking in the wrong spot until one of these
    // // schedules runs again.
    // return await manageLightCircadian(
    //   entity as unknown as ColorLight,
    //   expected,
    // );
  }

  const rooms = new Set<RoomDefinition<string>>();

  function buildLightList(): DiffList[] {
    // * Produce a list of lights that are supposed to be turned on
    // > Source from the active scene in each loaded room
    const lightsToCheck = is.unique(
      [...rooms.values()].flatMap((room) => {
        const current = room.currentSceneDefinition?.definition;
        if (!current) {
          // ? Room set to invalid scene
          // Notice already being emitted from room extension
          return [];
        }
        return Object.keys(room.currentSceneDefinition.definition).filter(
          (key) => {
            if (!is.domain(key, "light")) {
              return false;
            }
            // TODO: Introduce additional checks for items like rgb color
            return room.currentSceneDefinition.definition[key].state !== "off";
          },
        );
      }),
    ) as PICK_ENTITY<"light">[];

    // * Calculate how off the light is, omit ones that within tolerance, sort list by difference
    return lightsToCheck
      .map((light) => ({
        diff: getCurrentDiff(hass.entity.byId(light)),
        light,
      }))
      .filter(({ diff }) => diff >= config.automation.CIRCADIAN_DIFF_THRESHOLD)
      .sort((a, b) => (a.diff > b.diff ? UP : DOWN));
  }

  // # Light temperature adjustments
  // - seek out all lights that are turned on / tracking light temp
  // - sort by how off target they are
  // - adjust them at a relatively constant rate until all have been called
  // - start over every 30 s
  //   ~ if a new iteration starts before the previous one finishes:
  //   ~ the previous is halted and a warning is emitted
  //
  // Could be too many lights, or long response times. Depends on individual setup
  lifecycle.onPostConfig(() => {
    if (!config.automation.CIRCADIAN_ENABLED) {
      return;
    }
    logger.debug(`setting up light adjustment cron`);
    let earlyStop: () => void;
    scheduler.cron({
      exec: async () => {
        let stopped = false;
        if (earlyStop) {
          earlyStop();
        }
        const list = buildLightList();
        let complete = NONE;
        earlyStop = () => {
          logger.warn(
            { complete, total: list.length },
            `light temperature adjustment not complete yet`,
          );
          stopped = true;
          earlyStop = undefined;
        };
        await eachLimit(
          list,
          config.automation.CIRCADIAN_RATE,
          async ({ light, diff }) => {
            if (stopped) {
              return;
            }
            logger.trace({ diff, name: light }, `adjusting light temperature`);
            await hass.call.light.turn_on({
              entity_id: light,
              kelvin: automation.circadian.getKelvin(),
            });
            complete++;
            await sleep(config.automation.CIRCADIAN_THROTTLE);
          },
        );
        earlyStop = undefined;
      },
      schedule: CronExpression.EVERY_30_SECONDS,
    });
  });

  return {
    manageLight,
    registerRoom: (room: RoomDefinition) => rooms.add(room),
  };
}
