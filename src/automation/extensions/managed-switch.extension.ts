import { TServiceParams } from "../../boilerplate";
import { CronExpression, is, SINGLE, TContext } from "../../utilities";
import { ManagedSwitchOptions, PickASwitch } from "../helpers";

export function ManagedSwitch({ logger, hass, scheduler }: TServiceParams) {
  /**
   * Logic runner for the state enforcer
   */
  async function updateEntities(
    current: boolean,
    switches: PickASwitch[],
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
    const entity_id = [switches]
      .flat()
      .map(i => (is.string(i) ? i : i.entity_id));

    const shouldExecute = entity_id.some(
      id => !action.includes(hass.entity.byId(id)?.state?.toLocaleLowerCase()),
    );
    if (!shouldExecute) {
      return;
    }
    // * Notify and execute!
    if (entity_id.length === SINGLE) {
      logger.debug({ name: entity_id }, action);
    } else {
      logger.debug({ action, entity_id });
    }
    await hass.call.switch[action]({ entity_id });
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  function ManageSwitch({
    context,
    entity_id,
    schedule = CronExpression.EVERY_MINUTE,
    shouldBeOn,
    onUpdate = [],
  }: ManagedSwitchOptions) {
    logger.info({ context, entity_id }, `setting up managed switch`);
    const entityList = is.array(entity_id) ? entity_id : [entity_id];

    // * Check if there should be a change
    const update = async () => {
      const expected = shouldBeOn();
      if (!is.boolean(expected)) {
        if (!is.undefined(expected)) {
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

    // * Always run on a schedule
    scheduler.cron({ context, exec: async () => await update(), schedule });

    // * Update when relevant things update
    if (!is.empty(onUpdate)) {
      [onUpdate].flat().forEach(i => {
        if (is.object(i) && !("entity_id" in i)) {
          const onUpdate = i.onUpdate;
          if (!is.function(onUpdate)) {
            return;
          }
          i.onUpdate(async () => {
            await update();
          });
          return;
        }
        hass.entity
          .byId(is.object(i) ? i.entity_id : i)
          .onUpdate(async () => await update());
      });
    }
  }
  return ManageSwitch;
}
