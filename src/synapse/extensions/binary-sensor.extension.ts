import { TServiceParams } from "../../boilerplate";
import { TContext } from "../../utilities";
import { OnOff } from "..";

type TBinarySensor = {
  context: TContext;
  defaultState?: OnOff;
  icon?: string;
  name: string;
};

export type VirtualBinarySensor = {
  state: OnOff;
  name: string;
  icon: string;
  on: boolean;
};

export function BinarySensor({
  logger,
  context,
  lifecycle,
  synapse,
}: TServiceParams) {
  const registry = synapse.registry<VirtualBinarySensor>({
    context,
    details: item => ({ state: item.state }),
    domain: "binary_sensor",
  });

  // # Binary sensor entity creation function
  function create(sensor: TBinarySensor) {
    let state: OnOff;

    // ## Handle state updates. Ignore non-updates
    async function setState(newState: OnOff) {
      if (newState === state) {
        return;
      }
      state = newState;
      setImmediate(async () => {
        logger.trace(
          {
            name: sensor.context,
            sensor: sensor.name,
          },
          `syncing state`,
        );
        await registry.setCache(id, state);
        await registry.send(id, { state });
      });
    }

    // ## Wait until bootstrap to load cache
    lifecycle.onBootstrap(async () => {
      state = await registry.getCache(id, sensor.defaultState ?? "off");
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
    const id = registry.add(out);
    return out;
  }

  return create;
}
