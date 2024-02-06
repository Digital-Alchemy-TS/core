import { InternalError, TServiceParams } from "../../boilerplate";
import { PICK_ENTITY } from "../../hass";
import { is, TContext } from "../../utilities";
import { Icon, OnOff } from "..";

type TBinarySensor = {
  context: TContext;
  defaultState?: OnOff;
  icon?: Icon;
  id: string;
  name?: string;
};

const CACHE_KEY = (key: string) => `binary_sensor_state_cache:${key}`;

export type VirtualBinarySensor = {
  state: OnOff;
  entity_id: PICK_ENTITY<"binary_sensor">;
  on: boolean;
};

export function BinarySensor({
  logger,
  cache,
  context,
  lifecycle,
}: TServiceParams) {
  const registry = new Map<string, TBinarySensor>();
  let available = false;

  lifecycle.onBootstrap(() => {
    available = true;
  });

  function create(sensor: TBinarySensor) {
    if (is.empty(sensor.id)) {
      throw new InternalError(context, "INVALID_ID", "id is required");
    }
    if (registry.has(sensor.id)) {
      throw new InternalError(
        context,
        "DUPLICATE_SENSOR",
        "sensor id is already in use",
      );
    }
    logger.debug({ sensor }, `create sensor`);
    registry.set(sensor.id, sensor);

    let state: OnOff;

    async function setState(newState: OnOff) {
      state = newState;
      await cache.set(CACHE_KEY(sensor.id), state);
    }

    async function loadValue() {
      state = await cache.get(
        CACHE_KEY(sensor.id),
        sensor.defaultState ?? "off",
      );
    }
    if (available) {
      setImmediate(async () => await loadValue());
    }

    return new Proxy({} as VirtualBinarySensor, {
      get(_, property: keyof VirtualBinarySensor) {
        if (property === "state") {
          return state;
        }
        if (property === "on") {
          return state === "on";
        }
        if (property === "entity_id") {
          return `binary_sensor.${sensor.id}`;
        }
        return undefined;
      },
      set(_, property: keyof VirtualBinarySensor, value: OnOff) {
        if (property === "state") {
          setImmediate(async () => await setState(value));
          return true;
        }
        return false;
      },
    });
  }

  return create;
}
