import { eachSeries } from "async";

import { TServiceParams } from "../../boilerplate";
import { PICK_ENTITY } from "../../hass";
import { InternalServerError } from "../../server";
import { VirtualSensor } from "../../synapse";
import { CronExpression, is, VALUE } from "../../utilities";
import { RoomConfiguration, RoomScene, SceneLightState } from "../helpers";

type RoomDefinition<SCENES extends string> = {
  scene: SCENES;
  currentSceneEntity: VirtualSensor<SCENES>;
  sceneId: (scene: SCENES) => PICK_ENTITY<"scene">;
};
interface HasKelvin {
  kelvin: number;
}

export function SceneRoom({
  logger,
  scheduler,
  hass,
  synapse,
  automation,
  context: parentContext,
}: TServiceParams) {
  // eslint-disable-next-line sonarjs/cognitive-complexity
  return function <SCENES extends string>({
    name,
    id,
    context,
    scenes,
  }: RoomConfiguration<SCENES>): RoomDefinition<SCENES> {
    logger.info({ id, name }, `Create room`);

    const currentScene = synapse.sensor<SCENES>({
      context,
      id: `${id}_current_scene`,
    });

    scheduler.cron({
      context,
      exec: async () =>
        await automation.aggressive.validateRoomScene(
          scenes[currentScene.state as SCENES],
        ),
      schedule: CronExpression.EVERY_30_SECONDS,
    });

    /**
     * Should circadian if:
     *  - auto circadian is not disabled
     *  - is a light, that is currently on
     *  - the light was recently turned off (<5s)
     */
    function shouldCircadian(
      entity_id: PICK_ENTITY<"light">,
      target?: string,
    ): boolean {
      if (!is.domain(entity_id, "light")) {
        return false;
      }
      if (!is.empty(target) && target !== "on") {
        return false;
      }
      const current = (scenes[currentScene.state as SCENES] ?? {}) as RoomScene;
      const definition = current.definition;
      if (entity_id in definition) {
        const state = definition[entity_id] as SceneLightState;
        return Object.keys(state).every(i =>
          ["state", "brightness"].includes(i),
        );
      }
      return true;
    }

    function dynamicProperties(sceneName: SCENES) {
      const item = scenes[sceneName] as RoomScene;
      const definition = item.definition as Record<
        PICK_ENTITY<"light">,
        SceneLightState
      >;
      const entities = Object.keys(item.definition) as PICK_ENTITY<"light">[];
      const kelvin = automation.circadian.getKelvin();
      const list = entities
        .map(name => {
          const value = definition[name] as SceneLightState;

          if (is.domain(name, "switch")) {
            return [name, value];
          }
          if (!is.domain(name, "light")) {
            return undefined;
          }
          if (!shouldCircadian(name, value?.state)) {
            return [name, value];
          }
          logger.debug({ name }, `circadian`);
          return [name, { kelvin, ...value }];
        })
        .filter(i => !is.undefined(i));
      return {
        lights: Object.fromEntries(
          list.filter(i => !is.undefined((i[VALUE] as HasKelvin).kelvin)),
        ),
        scene: Object.fromEntries(
          list.filter(i => is.undefined((i[VALUE] as HasKelvin).kelvin)),
        ),
      };
    }

    async function sceneApply(sceneName: SCENES) {
      const { scene, lights } = dynamicProperties(sceneName);
      // Send most things through the expected scene apply
      // Send requests to set lights to a specific temperature through the `light.turn_on` call
      await Promise.all([
        // Normal scene set
        new Promise<void>(async done => {
          if (!is.empty(scene)) {
            await hass.call.scene.apply({
              entities: scene,
            });
          }
          done();
        }),
        // Set lights to current color temp
        new Promise<void>(async done => {
          await eachSeries(
            Object.keys(lights) as PICK_ENTITY<"light">[],
            async (entity_id: PICK_ENTITY<"light">) => {
              const change = lights[entity_id];
              await hass.call.light.turn_on({
                brightness: change.brightness,
                entity_id,
                kelvin: change.kelvin,
              });
            },
          );
          done();
        }),
      ]);
    }

    async function setScene(sceneName: SCENES) {
      // ensure not garbage inputs
      if (!is.string(sceneName) || !is.object(scenes[sceneName])) {
        throw new InternalServerError(
          parentContext,
          "INVALID_SCENE",
          `scene does not exist on room ${name}`,
        );
      }
      logger.info({ name, scene: sceneName }, `set scene`);
      await sceneApply(sceneName);
      currentScene.state = sceneName;
    }

    return new Proxy({} as RoomDefinition<SCENES>, {
      get: (_, property: keyof RoomDefinition<SCENES>) => {
        if (property === "scene") {
          return currentScene.state;
        }
        if (property === "sceneId") {
          return (scene: SCENES) => {
            return `scene.${id}_${scene}`;
          };
        }
        if (property === "currentSceneEntity") {
          return currentScene;
        }
        return undefined;
      },
      set: (_, property: keyof RoomDefinition<SCENES>, value) => {
        if (property === "scene") {
          setImmediate(async () => await setScene(value as SCENES));
          return true;
        }
        logger.error({ property }, `cannot set property on room`);
        return false;
      },
    });
  };
}
