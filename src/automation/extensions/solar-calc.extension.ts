import dayjs, { Dayjs } from "dayjs";
import { EventEmitter } from "node-cache";

import { TServiceParams } from "../../boilerplate";
import { HassConfig } from "../../hass";
import { CronExpression, TBlackHole, TContext, ZCC } from "../../utilities";
import { calcSolNoon, calcSunriseSet } from "..";

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

const solarEvents = [
  "dawn",
  "sunriseEnd",
  "sunsetStart",
  "dusk",
  "nightStart",
  "nightEnd",
  "sunrise",
  "sunset",
  "solarNoon",
] as SolarEvents[];

const CACHE_KEY = "SOLAR_CALC_CONFIG_CACHE";

const degreesBelowHorizon = {
  goldenHour: -6,
  nauticalTwilight: 12,
  night: 18,
  sunrise: 0.833,
  sunriseEnd: 0.3,
  twilight: 6,
};
const UNLIMITED = 0;

/**
 * Benefits from a persistent cache, like Redis
 */
export function SolarCalculator({
  logger,
  cache,
  scheduler,
  hass,
  lifecycle,
}: TServiceParams) {
  let config: HassConfig;
  const event = new EventEmitter();
  event.setMaxListeners(UNLIMITED);
  let lastEventAttachment: string;

  lifecycle.onBootstrap(async () => {
    config = await cache.get(CACHE_KEY);
    if (!config) {
      // Hold up bootstrapping for it
      logger.info(`no lat/long on hand, fetching from Home Assistant`);
      await updateLocation();
      return;
    }
    // Background update, just in case
    // Not expecting it to change, so it can be done in
    setImmediate(async () => await updateLocation());
  });

  // Rebuild references hourly
  //
  scheduler.cron({
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

    const now = dayjs();
    const today = now.format("YYYY-MM-DD");
    if (lastEventAttachment !== today) {
      lastEventAttachment = today;
      solarEvents.forEach((i: SolarEvents) => {
        if (solarReference[i].isBefore(now)) {
          return;
        }
        setTimeout(
          () => event.emit(i),
          Math.abs(now.diff(solarReference[i], "ms")),
        );
      });
    }
  }
  solarReference.loaded = false;

  solarReference.isBetween = (a: SolarEvents, b: SolarEvents) => {
    const now = dayjs();
    return now.isBetween(solarReference[a], solarReference[b]);
  };

  solarReference.onEvent = ({
    context,
    eventName,
    label,
    exec,
  }: OnSolarEvent) => {
    event.on(eventName, async () => {
      await ZCC.safeExec({
        duration: undefined,
        errors: undefined,
        exec: async () => await exec(),
        executions: undefined,
        labels: { context, label },
      });
    });
  };

  return solarReference as SolarReference;
}

type OnSolarEvent = {
  context: TContext;
  label?: string;
  eventName: SolarEvents;
  exec: () => TBlackHole;
};

type SolarReference = Record<SolarEvents, Dayjs> & {
  isBetween: (a: SolarEvents, b: SolarEvents) => boolean;
  loaded: boolean;
  onEvent: (options: OnSolarEvent) => TBlackHole;
};
