import { InternalError, TServiceParams } from "../../boilerplate";
import { PICK_ENTITY } from "../../hass";
import { BadRequestError, GENERIC_SUCCESS_RESPONSE } from "../../server";
import { is, TContext } from "../../utilities";
import { MaterialIcon, MaterialIconTags, OnOff } from "..";

type TSwitch<TAG extends MaterialIconTags = MaterialIconTags> = {
  context: TContext;
  defaultState?: OnOff;
  icon?: MaterialIcon<TAG>;
  id: string;
  name?: string;
};

const CACHE_KEY = (key: string) => `switch_state_cache:${key}`;

type LocalOnOff = "on" | "off";

export type VirtualSwitch<TAG extends MaterialIconTags = MaterialIconTags> = {
  state: LocalOnOff;
  on: boolean;
  icon: MaterialIcon<TAG>;
  id: string;
  name: string;
  entity_id: PICK_ENTITY<"switch">;
};

type UpdateSwitchBody = { switch: PICK_ENTITY<"switch">; state: LocalOnOff };

export function Switch({
  logger,
  cache,
  context,
  lifecycle,
  server,
  synapse,
}: TServiceParams) {
  const registry = new Map<PICK_ENTITY<"switch">, VirtualSwitch>();
  lifecycle.onBootstrap(() => BindHTTP());

  function BindHTTP() {
    const fastify = server.bindings.httpServer;

    // # Receive state update requests
    fastify.post<{
      Body: UpdateSwitchBody;
    }>(`/synapse/switch`, synapse.http.validation, request => {
      const entity = registry.get(request.body.switch);
      if (!entity) {
        throw new BadRequestError(
          context,
          "INVALID_BUTTON",
          `${request.body.switch} is not registered`,
        );
      }
      if (!["on", "off"].includes(request.body.state)) {
        throw new BadRequestError(
          context,
          "INVALID_STATE",
          "state must be 'on' or 'off'",
        );
      }
      entity.state = request.body.state;
      return GENERIC_SUCCESS_RESPONSE;
    });

    // # Describe the current situation
    fastify.get(`/synapse/switch`, synapse.http.validation, () => ({
      switches: [...registry.values()].map(entity => {
        return {
          icon: entity.icon,
          name: entity.name,
          state: entity.state,
        };
      }),
    }));
  }

  // # Switch entity creation function
  function create<TAG extends MaterialIconTags = MaterialIconTags>(
    entity: TSwitch<TAG>,
  ) {
    // ## Validate a good id was passed, and it's the only place in code that's using it
    if (!is.domain(entity.id, "switch")) {
      throw new InternalError(
        context,
        "INVALID_ID",
        "switch domain entity_id is required",
      );
    }
    if (registry.has(entity.id)) {
      throw new InternalError(
        context,
        "DUPLICATE_SENSOR",
        "sensor id is already in use",
      );
    }
    logger.debug({ entity }, `register entity`);

    let state: OnOff;

    // ## Handle state updates. Ignore non-updates
    async function setState(newState: OnOff) {
      if (newState === state) {
        return;
      }
      state = newState;
      await cache.set(CACHE_KEY(entity.id), state);
      logger.debug({ id: entity.id, newState }, `switch state updated`);
      synapse.http.emitWebhook({
        switch: {
          id: entity.id,
          state,
        },
      });
    }

    // ## Wait until bootstrap to load cache
    lifecycle.onBootstrap(async () => {
      state = await cache.get(
        CACHE_KEY(entity.id),
        entity.defaultState ?? "off",
      );
    });

    // ## Proxy object as return
    const returnEntity = new Proxy({} as VirtualSwitch, {
      get(_, property: keyof VirtualSwitch) {
        if (property === "state") {
          return state;
        }
        if (property === "on") {
          return state === "on";
        }
        if (property === "entity_id") {
          return entity.id;
        }
        if (property === "icon") {
          return entity.icon;
        }
        if (property === "name") {
          return entity.name;
        }
        return undefined;
      },
      set(_, property: keyof VirtualSwitch, value: OnOff) {
        if (property === "state") {
          setImmediate(async () => await setState(value));
          return true;
        }
        if (property === "on") {
          setImmediate(async () => await setState(value ? "on" : "off"));
          return true;
        }
        return false;
      },
    });

    // ## Register it
    registry.set(entity.id, returnEntity);
    return returnEntity;
  }

  return create;
}
