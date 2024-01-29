import { InternalError, TServiceParams } from "@zcc/boilerplate";
import { is, TContext } from "@zcc/utilities";

import { Icon } from "../helpers/index.mjs";

type TSensor<STATE extends SensorValue> = {
  context: TContext;
  defaultState?: STATE;
  icon?: Icon;
  id: string;
  name?: string;
};

type SensorValue = string | number;

const CACHE_KEY = (key: string) => `sensor_state_cache:${key}`;

export function Sensor({ logger, cache, context, lifecycle }: TServiceParams) {
  const registry = new Map<string, TSensor<SensorValue>>();
  let available = false;

  lifecycle.onBootstrap(() => {
    available = true;
  });

  function create<STATE extends SensorValue>(sensor: TSensor<STATE>) {
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

    let state: STATE;

    async function setState(newState: STATE) {
      state = newState;
      await cache.set(CACHE_KEY(sensor.id), state);
    }

    async function loadValue() {
      state = await cache.get(CACHE_KEY(sensor.id), sensor.defaultState);
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
        set(_, property: string, value: STATE) {
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
