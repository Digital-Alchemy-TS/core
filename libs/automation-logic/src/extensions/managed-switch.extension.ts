import { TServiceParams } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT, PICK_ENTITY } from "@zcc/hass";
import { CronExpression, is, TContext } from "@zcc/utilities";

import { ManagedSwitchOptions, PickASwitch } from "../helpers/index";

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
    entity_id: PickASwitch[],
    context: TContext,
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
      id =>
        !action.includes(
          hass.entity
            .byId(is.object(id) ? id.entity_id : id)
            ?.state?.toLocaleLowerCase(),
        ),
    );
    if (!shouldExecute) {
      return;
    }
    // * Notify and execute!
    const entities = entity_id.map(i => `[${i}]`).join(", ");
    logger.debug({ action, entities });

    await hass.call.switch[action]({ entity_id });
  }

  function ManageSwitch({
    context,
    entity_id,
    schedule = CronExpression.EVERY_10_MINUTES,
    shouldBeOn,
    onEvent = [],
    onEntityUpdate = [],
  }: ManagedSwitchOptions) {
    logger.info({ context, entity_id }, `Setting up managed switch`);
    const entityList = is.array(entity_id) ? entity_id : [entity_id];

    // Check if there should be a change
    const update = async () => {
      const expected = shouldBeOn();
      if (!is.boolean(expected)) {
        if (!is.undefined(expect)) {
          logger.error(
            { context, entity_id, expected },
            `Invalid value from switch manage function`,
          );
          return;
        }
        return;
      }
      await updateEntities(expected, entityList, context);
    };

    // Always run on a schedule
    scheduler.cron({ context, exec: async () => await update(), schedule });

    // Update when relevant entities update
    if (!is.empty(onEntityUpdate)) {
      [onEntityUpdate]
        .flat()
        .forEach(i =>
          hass.entity.OnUpdate(
            is.object(i) ? i.entity_id : i,
            async () => await update(),
          ),
        );
    }

    // Update on relevant events
    [onEvent].flat().forEach(eventName => {
      event.on(eventName, async () => await update());
    });
  }
  return ManageSwitch;
}
