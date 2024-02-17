import dayjs from "dayjs";

import { TServiceParams } from "../../boilerplate";
import { CronExpression } from "../../utilities";
import { LOCATION_UPDATED } from "../helpers";

const MIN = 0;
const MAX = 1;

/**
 * # Circadian lighting
 *
 * Generate an entity to maintain the current color temperature target for lights
 */
export function CircadianLighting({
  logger,
  lifecycle,
  scheduler,
  synapse,
  automation,
  config,
  context,
  event,
}: TServiceParams) {
  let circadianEntity: ReturnType<typeof synapse.sensor<number>>;

  lifecycle.onPostConfig(() => {
    if (!config.automation.CIRCADIAN_ENABLED) {
      logger.info(`circadian disabled`);
      return;
    }
    circadianEntity = synapse.sensor({
      context,
      device_class: "temperature",
      icon: "mdi:sun-thermometer",
      name: config.automation.CIRCADIAN_SENSOR_NAME,
      unit_of_measurement: "K",
    });
    out.circadianEntity = circadianEntity;

    scheduler.cron({
      context,
      exec: () => updateKelvin(),
      schedule: CronExpression.EVERY_30_SECONDS,
    });
  });

  event.on(LOCATION_UPDATED, () => updateKelvin());

  function updateKelvin() {
    if (!circadianEntity) {
      return;
    }
    if (!automation.solar.loaded) {
      logger.debug(`lat/long not loaded yet`);
      return;
    }
    const offset = getColorOffset();
    circadianEntity.state = Math.floor(
      (config.automation.CIRCADIAN_MAX_TEMP -
        config.automation.CIRCADIAN_MIN_TEMP) *
        offset +
        config.automation.CIRCADIAN_MIN_TEMP,
    );
  }

  /**
   * Returns 0 when it's dark out, increasing to 1 at solar noon
   */
  function getColorOffset(): number {
    if (!circadianEntity) {
      return MIN;
    }
    if (!automation.solar.loaded) {
      logger.debug(`lat/long not loaded yet`);
      return MIN;
    }
    const now = dayjs();
    const { solarNoon, dawn, dusk } = automation.solar;

    if (now.isBefore(dawn)) {
      // After midnight, but before dawn
      return MIN;
    }
    if (now.isBefore(solarNoon)) {
      // After dawn, but before solar noon
      return Math.abs(
        solarNoon.diff(now, "s") / solarNoon.diff(dawn, "s") - MAX,
      );
    }
    if (now.isBefore(dusk)) {
      // Afternoon, but before dusk
      return Math.abs(
        solarNoon.diff(now, "s") / solarNoon.diff(dusk, "s") - MAX,
      );
    }
    // Until midnight
    return MIN;
  }

  const out = {
    circadianEntity,
    getKelvin: () => circadianEntity?.state,
    updateKelvin,
  };
  return out;
}
