import { InternalError, TServiceParams } from "@zcc/boilerplate";
import { PICK_ENTITY } from "@zcc/hass";
import { is, TContext } from "@zcc/utilities";

import { Icon, OnOff } from "../helpers/index";

type TSwitch = {
  context: TContext;
  defaultState?: OnOff;
  icon?: Icon;
  id: string;
  name?: string;
};

const CACHE_KEY = (key: string) => `switch_state_cache:${key}`;

export type VirtualSwitch = {
  state: "on" | "off";
  on: boolean;
  entity_id: PICK_ENTITY<"switch">;
};

export function Switch({ logger, cache, context, lifecycle }: TServiceParams) {
  const registry = new Map<string, TSwitch>();
  let available = false;

  lifecycle.onBootstrap(() => {
    available = true;
  });

  function create(sensor: TSwitch) {
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

    return new Proxy({} as VirtualSwitch, {
      get(_, property: keyof VirtualSwitch) {
        if (property === "state") {
          return state;
        }
        if (property === "on") {
          return state === "on";
        }
        if (property === "entity_id") {
          return `switch.${sensor.id}`;
        }
        return undefined;
      },
      set(_, property: keyof VirtualSwitch, value: OnOff) {
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
