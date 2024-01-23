import { TServiceParams } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT, PICK_ENTITY } from "@zcc/home-assistant";
import { CronExpression, is } from "@zcc/utilities";

import { ManagedSwitchOptions } from "../helpers/managed-switch.helper.mjs";

export function ManagedSwitch({
  logger,
  getApis,
  event,
  scheduler,
}: TServiceParams) {
  const hass = getApis(LIB_HOME_ASSISTANT);

  /**
   * Logic runner for the state enforcer
   */
  async function updateEntities(
    current: boolean,
    entity_id: PICK_ENTITY<"switch">[],
    context: string,
  ): Promise<void> {
    // ? Bail out if no action can be taken
    if (!hass.socket.getConnectionActive()) {
      logger.warn(
        { context },
        `Skipping state enforce attempt, socket not available`,
      );
      return;
    }
    // Annotation can be used on property getter, or directly on a plain property (that some other logic updates)
    const action = current ? "turn_on" : "turn_off";

    const shouldExecute = entity_id.some(
      id => !action.includes(hass.entity.byId(id)?.state?.toLocaleLowerCase()),
    );
    if (!shouldExecute) {
      return;
    }
    // * Notify and execute!
    const entities = entity_id.map(i => `[${i}]`).join(", ");
    logger.debug(`${entities} {${action}}`);

    await hass.call.switch[action]({ entity_id });
  }

  return ({
    context,
    entity_id,
    interval = CronExpression.EVERY_10_MINUTES,
    shouldBeOn,
    ...data
  }: ManagedSwitchOptions) => {
    logger.info({ context, entity_id }, `Setting up managed switch`);
    const { onEntityUpdate: on_entity_update = [], onEvent: on_event = [] } =
      data;
    const entityList = is.string(entity_id) ? [entity_id] : entity_id;
    const update = async () => {
      const expected = shouldBeOn();
      if (!is.boolean(expected)) {
        return;
      }
      await updateEntities(expected, entityList, context);
    };
    scheduler({
      context,
      exec: async () => await update(),
      schedule: interval,
    });
    if (!is.empty(on_entity_update)) {
      [on_entity_update]
        .flat()
        .forEach(i => hass.entity.OnUpdate(i, async () => await update()));
    }
    [on_event].flat().forEach(eventName => {
      event.on(eventName, async () => await update());
    });
  };
}
