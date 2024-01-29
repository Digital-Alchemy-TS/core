import { InternalError, TServiceParams } from "@zcc/boilerplate";
import { is, TContext } from "@zcc/utilities";

import { Icon } from "../helpers/index.mjs";

type TBinarySensor = {
  context: TContext;
  defaultState?: boolean;
  icon?: Icon;
  id: string;
  name?: string;
};

const CACHE_KEY = (key: string) => `binary_sensor_state_cache:${key}`;

export function Switch({ logger, cache, context, lifecycle }: TServiceParams) {
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

    let state: boolean;

    async function setState(newState: boolean) {
      state = newState;
      await cache.set(CACHE_KEY(sensor.id), state);
    }

    async function loadValue() {
      state = await cache.get(
        CACHE_KEY(sensor.id),
        sensor.defaultState ?? false,
      );
    }
    if (available) {
      setImmediate(async () => await loadValue());
    }

    return new Proxy(
      {},
      {
        get(_, property: string) {
          return property === "state" ? state : undefined;
        },
        set(_, property: string, value: boolean) {
          if (property === "state") {
            setImmediate(async () => await setState(value));
            return true;
          }
          return false;
        },
      },
    );
  }

  return create;
}
