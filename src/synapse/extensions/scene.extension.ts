import { InternalError, TServiceParams } from "../../boilerplate";
import { PICK_ENTITY } from "../../hass";
import { BadRequestError, GENERIC_SUCCESS_RESPONSE } from "../../server";
import { is, TBlackHole, TContext, ZCC } from "../../utilities";
import {
  BUTTON_ERRORS,
  BUTTON_EXECUTION_COUNT,
  BUTTON_EXECUTION_TIME,
  MaterialIcon,
  MaterialIconTags,
} from "..";

type TScene<TAG extends MaterialIconTags = MaterialIconTags> = {
  exec: () => TBlackHole;
  context: TContext;
  label?: string;
  icon?: MaterialIcon<TAG>;
  id: string;
  name?: string;
};

export function Scene({
  logger,
  lifecycle,
  server,
  synapse,
  context: parentContext,
}: TServiceParams) {
  const registry = new Map<PICK_ENTITY<"scene">, TScene>();
  lifecycle.onBootstrap(() => BindHTTP());

  function BindHTTP() {
    const fastify = server.bindings.httpServer;
    // # Receive button press
    fastify.post<{
      Body: { scene: PICK_ENTITY<"scene"> };
    }>(`/synapse/scene`, synapse.http.validation, async function (request) {
      const scene = request.body.scene;
      if (!registry.has(scene)) {
        throw new BadRequestError(
          parentContext,
          "INVALID_SCENE",
          `${scene} is not registered`,
        );
      }
      logger.debug({ button: scene }, `Received scene press`);
      const { exec, context, label } = registry.get(scene);
      setImmediate(async () => {
        await ZCC.safeExec({
          duration: BUTTON_EXECUTION_TIME,
          errors: BUTTON_ERRORS,
          exec: async () => await exec(),
          executions: BUTTON_EXECUTION_COUNT,
          labels: { context, label },
        });
      });
      return GENERIC_SUCCESS_RESPONSE;
    });

    // # List scene
    fastify.get("/synapse/scene", synapse.http.validation, () => ({
      scenes: [...registry.values()].map(({ icon, id, name }) => {
        return { icon, id, name };
      }),
    }));
  }

  /**
   *  # Register a new scene
   */
  function create<TAG extends MaterialIconTags = MaterialIconTags>(
    entity: TScene<TAG>,
  ) {
    if (!is.domain(entity.id, "scene")) {
      throw new InternalError(
        parentContext,
        "INVALID_ID",
        "pass an entity id with a scene domain",
      );
    }
    if (registry.has(entity.id)) {
      throw new InternalError(
        parentContext,
        "DUPLICATE_SCENE",
        `${entity.id} is already in use`,
      );
    }
    logger.debug({ entity }, `register entity`);
    registry.set(entity.id, entity);
  }
  return create;
}
