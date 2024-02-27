import { TServiceParams } from "../../boilerplate";
import { each, TBlackHole, TContext, ZCC } from "../../utilities";

type TSwitch = {
  context: TContext;
  defaultState?: LocalOnOff;
  icon?: string;
  name: string;
};

type LocalOnOff = "on" | "off";

export type VirtualSwitch = {
  state: LocalOnOff;
  on: boolean;
  icon: string;
  name: string;
  onUpdate: (callback: SwitchUpdateCallback) => void;
};

type UpdateSwitchBody = {
  event_type: "digital_alchemy_switch_update";
  data: { data: { switch: string; state: LocalOnOff } };
};

type SwitchUpdateCallback = (state: boolean) => TBlackHole;

export function Switch({
  logger,
  context,
  lifecycle,
  hass,
  synapse,
}: TServiceParams) {
  const registry = synapse.registry<VirtualSwitch>({
    context,
    details: (entity) => ({
      state: entity.state,
    }),
    domain: "switch",
  });

  // ### Listen for socket events
  hass.socket.onEvent({
    context: context,
    event: "digital_alchemy_switch_update",
    exec({ data: { data } }: UpdateSwitchBody) {
      const item = registry.byId(data.switch);
      if (!item) {
        logger.warn(
          { data, id: data.switch },
          `received switch update for unknown switch`,
        );
        return;
      }
      const state = data.state;
      if (!["on", "off"].includes(state)) {
        logger.warn({ state }, `received bad value for state update`);
        return;
      }
      if (item.state === state) {
        return;
      }
      logger.trace(
        { label: item.name, state: data.state },
        `received state update`,
      );
      item.state = state;
    },
  });

  /**
   * ### Register a new switch
   *
   * Can be interacted with via return object, or standard home assistant switch services
   */
  function create(entity: TSwitch) {
    const callbacks = [] as SwitchUpdateCallback[];
    let state: LocalOnOff;

    function setState(newState: LocalOnOff) {
      if (newState === state) {
        return;
      }
      state = newState;
      setImmediate(async () => {
        logger.trace({ id, state }, `switch state updated`);
        await registry.setCache(id, state);
        await registry.send(id, { state });
        await each(
          callbacks,
          async (callback) =>
            await ZCC.safeExec(async () => await callback(state === "on")),
        );
      });
    }

    lifecycle.onBootstrap(async () => {
      state = await registry.getCache(id, entity.defaultState ?? "off");
    });

    const returnEntity = new Proxy({} as VirtualSwitch, {
      get(_, property: keyof VirtualSwitch) {
        if (property === "state") {
          return state;
        }
        if (property === "on") {
          return state === "on";
        }
        if (property === "icon") {
          return entity.icon;
        }
        if (property === "name") {
          return entity.name;
        }
        if (property === "onUpdate") {
          return (callback: SwitchUpdateCallback) => callbacks.push(callback);
        }
        return undefined;
      },
      set(_, property: keyof VirtualSwitch, value: LocalOnOff) {
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

    const id = registry.add(returnEntity);
    return returnEntity;
  }

  return create;
}
