import { TServiceParams } from "@zcc/boilerplate";
import { GenericEntityDTO, PICK_ENTITY } from "@zcc/home-assistant";
import { EMPTY, MINUTE, ZCC } from "@zcc/utilities";
import async from "async";
import dayjs from "dayjs";
import { get } from "object-path";

import {
  CIRCADIAN_ENABLED,
  CIRCADIAN_MAX_TEMP,
  CIRCADIAN_MIN_TEMP,
  CIRCADIAN_SENSOR,
} from "../helpers/configuration.helper.mjs";
import { LOCATION_UPDATED } from "../helpers/events.helper.mjs";

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
  getConfig,
}: TServiceParams) {
  //
  let maxTemperature: number;
  let minTemperature: number;
  let circadianEnabled: boolean;
  let circadianSensor: SENSOR;

  lifecycle.onPostConfig(() => {
    maxTemperature = getConfig(CIRCADIAN_MAX_TEMP);
    minTemperature = getConfig(CIRCADIAN_MIN_TEMP);
    circadianEnabled = getConfig(CIRCADIAN_ENABLED);
    circadianSensor = getConfig(CIRCADIAN_SENSOR);
  });

  // public get kelvin(): number {
  //   return Number(circadianEntity.state);
  // }

  // public get mireds(): number {
  //   return Math.floor(MIRED_CONVERSION / kelvin);
  // }

  // public circadianEntity: PUSH_PROXY<SENSOR>;

  async function onApplicationBootstrap() {
    if (!circadianEnabled) {
      logger.warn(`Circadian lighting updates disabled`);
      return;
    }
    pushEntity.insert(circadianSensor, {
      device_class: "temperature",
      icon: "mdi:sun-thermometer",
      name: "Light temperature",
      unit_of_measurement: "K",
    });
    circadianEntity = await pushProxy.createPushProxy(circadianSensor);
    updateKelvin();
    setInterval(() => {
      updateKelvin();
    }, MINUTE);
  }

  ZCC.event.on(LOCATION_UPDATED, () => updateKelvin());

  function updateKelvin() {
    if (!circadianEntity) {
      return;
    }
    if (solarCalc.latitude === EMPTY && solarCalc.longitude === EMPTY) {
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
   *
   * ! The math needs work, this seems more thought out because math reasons:
   * https://github.com/claytonjn/hass-circadian_lighting/blob/master/custom_components/circadian_lighting/__init__.py#L206
   */
  function getColorOffset(): number {
    const calc = solarCalc.getCalcSync();
    const noon = dayjs(calc.solarNoon);
    const dusk = dayjs(calc.dusk);
    const dawn = dayjs(calc.dawn);
    const now = dayjs();

    if (now.isBefore(dawn)) {
      // After midnight, but before dawn
      return MIN;
    }
    if (now.isBefore(noon)) {
      // After dawn, but before solar noon
      return Math.abs(noon.diff(now, "s") / noon.diff(dawn, "s") - MAX);
    }
    if (now.isBefore(dusk)) {
      // Afternoon, but before dusk
      return Math.abs(noon.diff(now, "s") / noon.diff(dusk, "s") - MAX);
    }
    // Until midnight
    return MIN;
  }
}
