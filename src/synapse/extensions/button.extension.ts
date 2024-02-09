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

type TButton<TAG extends MaterialIconTags = MaterialIconTags> = {
  exec: () => TBlackHole;
  context: TContext;
  label?: string;
  icon?: MaterialIcon<TAG>;
  name?: string;
};

export function Button({
  logger,
  lifecycle,
  server,
  synapse,
  context: parentContext,
}: TServiceParams) {
  const registry = new Map<string, TButton>();
  lifecycle.onBootstrap(() => BindHTTP());

  function BindHTTP() {
    const fastify = server.bindings.httpServer;
    // # Receive button press
    fastify.post<{
      Body: { button: PICK_ENTITY<"button"> };
    }>(`/synapse/button`, synapse.http.validation, async function (request) {
      const button = request.body.button;
      if (!registry.has(button)) {
        throw new BadRequestError(
          parentContext,
          "INVALID_BUTTON",
          `${button} is not registered`,
        );
      }
      const { exec, context, label, name } = registry.get(button);
      logger.trace({ button, label: name }, `received button press`);
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

    // # List buttons
    fastify.get("/synapse/button", synapse.http.validation, () => {
      logger.trace(`list [buttons]`);
      return {
        buttons: [...registry.values()].map(({ icon, name }) => {
          return {
            icon: is.empty(icon) ? icon : `mdi:${icon}`,
            id: is.hash(`${ZCC.application.name}:${name}`),
            name,
          };
        }),
      };
    });
  }

  // # Register a new button
  function create<TAG extends MaterialIconTags = MaterialIconTags>(
    entity: TButton<TAG>,
  ) {
    const id = is.hash(`${ZCC.application.name}:${entity.name}`);
    if (registry.has(id)) {
      throw new InternalError(
        parentContext,
        "DUPLICATE_BUTTON",
        `${id} is already in use`,
      );
    }
    logger.debug({ entity, id }, `register [button]`);
    registry.set(id, entity);
  }
  return create;
}
