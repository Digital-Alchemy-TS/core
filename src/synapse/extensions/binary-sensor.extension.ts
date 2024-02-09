import { InternalError, TServiceParams } from "../../boilerplate";
import { PICK_ENTITY } from "../../hass";
import { is, TContext, ZCC } from "../../utilities";
import { MaterialIcon, MaterialIconTags, OnOff } from "..";

type TBinarySensor<TAG extends MaterialIconTags = MaterialIconTags> = {
  context: TContext;
  defaultState?: OnOff;
  icon?: MaterialIcon<TAG>;
  name?: string;
};

const CACHE_KEY = (key: string) => `binary_sensor_state_cache:${key}`;

export type VirtualBinarySensor<
  TAG extends MaterialIconTags = MaterialIconTags,
> = {
  state: OnOff;
  entity_id: PICK_ENTITY<"binary_sensor">;
  name: string;
  icon: MaterialIcon<TAG>;
  on: boolean;
};

export function BinarySensor({
  logger,
  cache,
  context,
  lifecycle,
  server,
  synapse,
}: TServiceParams) {
  const registry = new Map<string, VirtualBinarySensor>();
  lifecycle.onBootstrap(() => BindHTTP());

  function BindHTTP() {
    const fastify = server.bindings.httpServer;

    // # Describe the current situation
    fastify.get("/synapse/binary_sensor", synapse.http.validation, () => {
      logger.trace(`list [binary_sensors]`);
      return {
        binary_sensors: [...registry.values()].map(i => {
          return {
            icon: i.icon,
            id: i.entity_id,
            name: i.name,
            state: i.state,
          };
        }),
      };
    });
  }

  // # Binary sensor entity creation function
  function create<TAG extends MaterialIconTags = MaterialIconTags>(
    sensor: TBinarySensor<TAG>,
  ) {
    const id = is.hash(`${ZCC.application.name}:${sensor.name}`);
    // ## Validate a good id was passed, and it's the only place in code that's using it
    if (registry.has(id)) {
      throw new InternalError(
        context,
        "DUPLICATE_SENSOR",
        "sensor id is already in use",
      );
    }
    logger.debug({ sensor }, `register [binary_sensor]`);
    let state: OnOff;

    // ## Handle state updates. Ignore non-updates
    async function setState(newState: OnOff) {
      state = newState;
      setImmediate(async () => {
        await cache.set(CACHE_KEY(id), state);
      });
    }

    // ## Wait until bootstrap to load cache
    lifecycle.onBootstrap(async () => {
      state = await cache.get(CACHE_KEY(id), sensor.defaultState ?? "off");
    });

    // ## Proxy object as return
    const out = new Proxy({} as VirtualBinarySensor, {
      get(_, property: keyof VirtualBinarySensor) {
        if (property === "state") {
          return state;
        }
        if (property === "on") {
          return state === "on";
        }
        if (property === "entity_id") {
          return id;
        }
        if (property === "icon") {
          return sensor.icon;
        }
        if (property === "name") {
          return sensor.name;
        }
        return undefined;
      },
      set(_, property: keyof VirtualBinarySensor, value: unknown) {
        if (property === "state") {
          setState(value as OnOff);
          return true;
        }
        if (property === "on") {
          setState(value ? "on" : "off");
          return true;
        }
        return false;
      },
    });
    registry.set(id, out);
    return out;
  }

  return create;
}
