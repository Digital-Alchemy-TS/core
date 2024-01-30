import { TServiceParams } from "@zcc/boilerplate";
import { HassConfig, LIB_HOME_ASSISTANT } from "@zcc/home-assistant";
import { CronExpression } from "@zcc/utilities";
import dayjs, { Dayjs } from "dayjs";

import { calcSolNoon, calcSunriseSet } from "../index.mjs";

export type SolarEvents =
  | "dawn"
  | "dusk"
  | "solarNoon"
  | "sunrise"
  | "nightStart"
  | "nightEnd"
  | "sunset"
  | "sunriseEnd"
  | "sunsetStart";

const CACHE_KEY = "SOLAR_CALC_CONFIG_CACHE";

const degreesBelowHorizon = {
  goldenHour: -6,
  nauticalTwilight: 12,
  night: 18,
  sunrise: 0.833,
  sunriseEnd: 0.3,
  twilight: 6,
};

/**
 * Benefits from a persistent cache, like Redis
 */
export function SolarCalculator({
  logger,
  cache,
  scheduler,
  context,
  getApis,
  lifecycle,
}: TServiceParams) {
  let config: HassConfig;
  const hass = getApis(LIB_HOME_ASSISTANT);

  lifecycle.onBootstrap(async () => {
    config = await cache.get(CACHE_KEY);
    if (!config) {
      // Hold up bootstrapping for it
      logger.info(`No lat/long on hand, fetching from Home Assistant`);
      await updateLocation();
      return;
    }
    // Background update, just in case
    // Not expecting it to change, so it can be done in
    setImmediate(async () => await updateLocation());
  });

  // Rebuild references hourly
  //
  scheduler({
    context,
    exec: () => PopulateReferences(),
    schedule: CronExpression.EVERY_HOUR,
  });

  async function updateLocation() {
    config = await hass.fetch.getConfig();
    await cache.set(CACHE_KEY, config);
    PopulateReferences();
  }

  const solarReference: Partial<SolarReference> = {};

  async function PopulateReferences() {
    solarReference.dawn = dayjs(
      calcSunriseSet(
        true,
        degreesBelowHorizon.twilight,
        config.latitude,
        config.longitude,
      ),
    );

    solarReference.sunriseEnd = dayjs(
      calcSunriseSet(
        true,
        degreesBelowHorizon.sunriseEnd,
        config.latitude,
        config.longitude,
      ),
    );

    solarReference.sunsetStart = dayjs(
      calcSunriseSet(
        false,
        degreesBelowHorizon.sunriseEnd,
        config.latitude,
        config.longitude,
      ),
    );

    solarReference.dusk = dayjs(
      calcSunriseSet(
        false,
        degreesBelowHorizon.twilight,
        config.latitude,
        config.longitude,
      ),
    );

    solarReference.nightStart = dayjs(
      calcSunriseSet(
        false,
        degreesBelowHorizon.night,
        config.latitude,
        config.longitude,
      ),
    );

    solarReference.nightEnd = dayjs(
      calcSunriseSet(
        true,
        degreesBelowHorizon.night,
        config.latitude,
        config.longitude,
      ),
    );

    solarReference.sunrise = dayjs(
      calcSunriseSet(
        true,
        degreesBelowHorizon.sunrise,
        config.latitude,
        config.longitude,
      ),
    );

    solarReference.sunset = dayjs(
      calcSunriseSet(
        false,
        degreesBelowHorizon.sunrise,
        config.latitude,
        config.longitude,
      ),
    );

    solarReference.solarNoon = dayjs(calcSolNoon(config.longitude));
    solarReference.loaded = true;
  }
  solarReference.loaded = false;

  solarReference.isBetween = (a: SolarEvents, b: SolarEvents) => {
    const now = dayjs();
    return now.isBetween(solarReference[a], solarReference[b]);
  };

  return solarReference as SolarReference;
}

type SolarReference = Record<SolarEvents, Dayjs> & {
  isBetween: (a: SolarEvents, b: SolarEvents) => boolean;
  loaded: boolean;
};
