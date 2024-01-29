import { TServiceParams } from "@zcc/boilerplate";
import { GenericEntityDTO, PICK_ENTITY } from "@zcc/home-assistant";
import { MINUTE } from "@zcc/utilities";
import { LIB_VIRTUAL_ENTITY } from "@zcc/virtual-entity";
import dayjs from "dayjs";

import { LIB_AUTOMATION_LOGIC } from "../automation-logic.module.mjs";
import { LOCATION_UPDATED } from "../helpers/index.mjs";

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
const MIRED_CONVERSION = 1_000_000;

export function CircadianLighting({
  logger,
  lifecycle,
  getApis,
  scheduler,
  context,
  event,
}: TServiceParams) {
  const virtual = getApis(LIB_VIRTUAL_ENTITY);
  const automation = getApis(LIB_AUTOMATION_LOGIC);

  let maxTemperature: number;
  let minTemperature: number;
  let circadianEnabled: boolean;

  let circadianEntity: ReturnType<typeof virtual.sensor<number>>;

  lifecycle.onPostConfig(() => {
    maxTemperature = LIB_AUTOMATION_LOGIC.getConfig("CIRCADIAN_MAX_TEMP");
    minTemperature = LIB_AUTOMATION_LOGIC.getConfig("CIRCADIAN_MIN_TEMP");
    circadianEnabled = LIB_AUTOMATION_LOGIC.getConfig("CIRCADIAN_ENABLED");

    if (!circadianEnabled) {
      logger.info(`circadian disabled`);
      return;
    }
    circadianEntity = virtual.sensor({
      context,
      device_class: "temperature",
      icon: "mdi:sun-thermometer",
      id: LIB_AUTOMATION_LOGIC.getConfig("CIRCADIAN_SENSOR"),
      name: "Light temperature",
      unit_of_measurement: "K",
    });

    scheduler({
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
      logger.debug(`[lat]/[long] not loaded yet`);
      return;
    }
    const offset = getColorOffset();
    circadianEntity.state = Math.floor(
      (maxTemperature - minTemperature) * offset + minTemperature,
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
      logger.debug(`[lat]/[long] not loaded yet`);
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
