import {
  CronExpression,
  eachSeries,
  InternalError,
  is,
  TServiceParams,
  VALUE,
  ZCC,
} from "../..";
import { PICK_ENTITY } from "../../hass";
import { VirtualSensor } from "../../synapse";
import { RoomConfiguration, RoomScene, SceneLightState } from "..";

export type RoomDefinition<SCENES extends string = string> = {
  scene: SCENES;
  currentSceneDefinition: RoomScene;
  currentSceneEntity: VirtualSensor<SCENES>;
  sceneId: (scene: SCENES) => PICK_ENTITY<"scene">;
};
interface HasKelvin {
  kelvin: number;
}

export function Room({
  logger,
  hass,
  synapse,
  scheduler,
  automation,
  context: parentContext,
}: TServiceParams) {
  // eslint-disable-next-line sonarjs/cognitive-complexity
  return function <SCENES extends string>({
    name,
    context,
    scenes,
  }: RoomConfiguration<SCENES>): RoomDefinition<SCENES> {
    logger.info({ name }, `create room`);
    const SCENE_LIST = Object.keys(scenes) as SCENES[];

    const sensorName = `${name} current scene`;
    const currentScene = synapse.sensor<SCENES>({
      context,
      name: sensorName,
    });

    function restoreFromEntity() {
      const importedValue = hass.entity.byId(ZCC.toHassId("sensor", sensorName))
        .state as SCENES;
      const current = currentScene.state;
      if (is.empty(current) && !SCENE_LIST.includes(importedValue)) {
        return undefined;
      }
      currentScene.state = importedValue;
      return importedValue;
    }

    scheduler.cron({
      exec: async () => {
        let current = currentScene.state;
        if (!SCENE_LIST.includes(current)) {
          current = restoreFromEntity();
          if (!SCENE_LIST.includes(current)) {
            logger.warn(
              { name, scene: current || "(empty string)" },
              `room is set to an invalid scene`,
            );
            return;
          }
          logger.debug({ current, name: sensorName }, `imported value restore`);
        }
        await automation.aggressive.validateRoomScene({
          context,
          name: current,
          room: name,
          scene: scenes[current],
        });
      },
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
        return Object.keys(state).every((i) =>
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
        .map((name) => {
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
          return [name, { kelvin, ...value }];
        })
        .filter((i) => !is.undefined(i));
      return {
        lights: Object.fromEntries(
          list.filter((i) => !is.undefined((i[VALUE] as HasKelvin).kelvin)),
        ),
        scene: Object.fromEntries(
          list.filter((i) => is.undefined((i[VALUE] as HasKelvin).kelvin)),
        ),
      };
    }

    async function sceneApply(sceneName: SCENES) {
      const { scene, lights } = dynamicProperties(sceneName);
      // Send most things through the expected scene apply
      // Send requests to set lights to a specific temperature through the `light.turn_on` call
      await Promise.all([
        // Normal scene set
        new Promise<void>(async (done) => {
          if (!is.empty(scene)) {
            await hass.call.scene.apply({
              entities: scene,
            });
          }
          done();
        }),
        // Set lights to current color temp
        new Promise<void>(async (done) => {
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
        throw new InternalError(
          parentContext,
          "INVALID_SCENE",
          `scene does not exist on room ${name}`,
        );
      }
      logger.info({ name }, `set scene {%s}`, sceneName);
      currentScene.state = sceneName;
      await sceneApply(sceneName);
    }

    SCENE_LIST.forEach((scene) => {
      const sceneName = `${name} ${scene}`;
      synapse.scene({
        context,
        exec: async () => {
          logger.trace({ name: sceneName }, `scene activate`);
          await setScene(scene as SCENES);
        },
        name: sceneName,
      });
    });

    const out = new Proxy({} as RoomDefinition<SCENES>, {
      get: (_, property: keyof RoomDefinition<SCENES>) => {
        if (property === "scene") {
          return currentScene.state;
        }
        if (property === "sceneId") {
          return (scene: SCENES) => {
            return ZCC.toHassId("scene", name, scene);
          };
        }
        if (property === "currentSceneEntity") {
          return currentScene;
        }
        if (property === "currentSceneDefinition") {
          return scenes[currentScene.state];
        }
        return undefined;
      },
      set: (_, property: keyof RoomDefinition<SCENES>, value) => {
        if (property === "scene") {
          setImmediate(
            async () =>
              // ? This way adds a network hop, allows hass to create a logbook entry for the call
              await hass.call.scene.turn_on({
                entity_id: ZCC.toHassId("scene", name, value),
              }),
          );
          return true;
        }
        logger.error({ property }, `cannot set property on room`);
        return false;
      },
    });

    // FIXME: This casting shouldn't be needed, why is string not assignable to string?
    // No idea, but I spent 30 minutes trying to figure it out, and I'm really mad at it
    automation.light.registerRoom(out as unknown as RoomDefinition);

    return out;
  };
}
