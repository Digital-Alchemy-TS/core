import dayjs from "dayjs";

import { TServiceParams } from "../../boilerplate";
import { GenericEntityDTO, PICK_ENTITY } from "../../hass";
import { MINUTE } from "../../utilities";
import { LOCATION_UPDATED } from "../helpers";

type ColorModes = "color_temp" | "xy" | "brightness";
export type ColorLight = GenericEntityDTO<{
  brightness: number;
  color_mode: ColorModes;
  color_temp: number;
  color_temp_kelvin: number;
  entity_id: PICK_ENTITY<"light">[];
  hs_color: [h: number, s: number];
  max_color_temp_kelvin: number;
  max_mireds: number;
  min_color_temp_kelvin: number;
  min_mireds: number;
  rgb_color: [number, number, number];
  supported_color_modes: ColorModes[];
  supported_features: number;
  xy_color: [x: number, y: number];
}>;
const MIN = 0;
const MAX = 1;
// const MIRED_CONVERSION = 1_000_000;

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
      icon: "sun",
      name: config.automation.CIRCADIAN_SENSOR_NAME,
      unit_of_measurement: "K",
    });

    scheduler.interval({
      context,
      exec: () => updateKelvin(),
      interval: MINUTE,
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

  return {
    getKelvin: () => circadianEntity?.state,
    updateKelvin,
  };
}
