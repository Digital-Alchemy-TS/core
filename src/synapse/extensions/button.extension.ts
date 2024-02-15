import { TBlackHole, TContext, TServiceParams, ZCC } from "../..";
import {
  BUTTON_ERRORS,
  BUTTON_EXECUTION_COUNT,
  BUTTON_EXECUTION_TIME,
} from "..";

type TButton = {
  exec: () => TBlackHole;
  context: TContext;
  label?: string;
  icon?: string;
  name: string;
};

type HassButtonUpdateEvent = {
  event_type: "zcc_activate";
  data: { id: string };
};

export function Button({ logger, hass, context, synapse }: TServiceParams) {
  const registry = synapse.registry<TButton>({
    context,
    domain: "button",
  });

  // ### Listen for socket events
  hass.socket.onEvent({
    context: context,
    event: "zcc_activate",
    exec({ data }: HassButtonUpdateEvent) {
      const item = registry.byId(data.id);
      if (!item) {
        return;
      }
      const { exec, context, label, name } = item;
      logger.trace({ data, label: name }, `received button press`);
      setImmediate(async () => {
        await ZCC.safeExec({
          duration: BUTTON_EXECUTION_TIME,
          errors: BUTTON_ERRORS,
          exec: async () => await exec(),
          executions: BUTTON_EXECUTION_COUNT,
          labels: { context, label },
        });
      });
    },
  });

  /**
   * ### Register a new button
   *
   * Can be called from construction phase - bootstrap.
   * Auto syncs with home assistant onReady, and will emit warnings for new buttons after.
   *
   * Warnings indicate that a manual update of the integration may be required.
   */
  return function create(entity: TButton) {
    registry.add(entity);
  };
}
