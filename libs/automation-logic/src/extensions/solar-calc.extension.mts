import { InternalError, TServiceParams } from "@zcc/boilerplate";
import { HALF, is, MINUTE, sleep } from "@zcc/utilities";
import { CronTime } from "cron";
import dayjs from "dayjs";
import SolarCalc from "solar-calc";
import SolarCalcType from "solar-calc/types/solarCalc";

import {
  SOLAR_EVENT_TRIGGER,
  SolarEventTriggerData,
} from "../helpers/events.helper.mjs";

const CALC_EXPIRE = HALF * MINUTE;
export enum SolarEvents {
  astronomicalDawn = "astronomicalDawn",
  astronomicalDusk = "astronomicalDusk",
  civilDawn = "civilDawn",
  civilDusk = "civilDusk",
  dawn = "dawn",
  dusk = "dusk",
  nauticalDawn = "nauticalDawn",
  nauticalDusk = "nauticalDusk",
  nightEnd = "nightEnd",
  nightStart = "nightStart",
  solarNoon = "solarNoon",
  sunrise = "sunrise",
  sunriseEnd = "sunriseEnd",
  sunset = "sunset",
  sunsetStart = "sunsetStart",
}

const SOLAR_CACHE = "SOLAR_CACHE";
type CacheData = {
  lat: number;
  long: number;
};
const claimed = false;
const DEFAULT_POSITION = 0;

export function SolarCalculator({ logger, cache, context }: TServiceParams) {
  const latitude = DEFAULT_POSITION;
  const longitude = DEFAULT_POSITION;
  let CALCULATOR: SolarCalcType;
  const callbacks = new Map<SolarOptions, AnnotationPassThrough[]>();
  const emit = false;

  const object = {
    astronomicalDawn: () => getCalcSync().astronomicalDawn,
    astronomicalDusk: () => getCalcSync().astronomicalDusk,
    civilDawn: () => getCalcSync().civilDawn,
    civilDusk: () => getCalcSync().civilDusk,
    dawn: () => getCalcSync().dawn,
    dusk: () => getCalcSync().dusk,
    goldenHourEnd: () => getCalcSync().goldenHourEnd,
    goldenHourStart: () => getCalcSync().goldenHourStart,
    nauticalDawn: () => getCalcSync().nauticalDawn,
    nauticalDusk: () => getCalcSync().nauticalDusk,
    nightEnd: () => getCalcSync().nightEnd,
    nightStart: () => getCalcSync().nightStart,
    solarNoon: () => getCalcSync().solarNoon,
    sunrise: () => getCalcSync().sunrise,
    sunriseEnd: () => getCalcSync().sunriseEnd,
    sunset: () => getCalcSync().sunset,
    sunsetStart: () => getCalcSync().sunsetStart,
  };

  // public get SOLAR_CALC(): SolarCalcType {
  //   if (CALCULATOR) {
  //     return CALCULATOR;
  //   }
  //   setTimeout(() => (CALCULATOR = undefined), CALC_EXPIRE);
  //   // @ts-expect-error Typescript is wrong this time, this works as expected
  //   return new SolarCalc(new Date(), latitude, longitude);
  // }

  function between(start: `${SolarEvents}`, end: `${SolarEvents}`): boolean {
    const calc = getCalcSync();
    const now = dayjs();
    return now.isAfter(calc[start]) && now.isBefore(calc[end]);
  }

  function SOLAR_CALC() {
    if (CALCULATOR) {
      return CALCULATOR;
    }
    setTimeout(() => (CALCULATOR = undefined), CALC_EXPIRE);
    // @ts-expect-error Typescript is wrong this time, this works as expected
    return new SolarCalc(new Date(), latitude, longitude);
  }

  /**
   * Retrieve calculator, wait for lat / long (if maybe not available)
   */
  async function getCalc(referenceDate?: Date): Promise<SolarCalcType> {
    if (referenceDate) {
      // @ts-expect-error Typescript is wrong this time, this works as expected
      return new SolarCalc(referenceDate, latitude, longitude);
    }
    if (!is.number(latitude) || !is.number(longitude)) {
      logger.debug(`Waiting for {lat}/{long}`);
      await sleep();
      return await getCalc();
    }
    return SOLAR_CALC();
  }

  /**
   * Retrieve calculator, throws error if lat / long not available
   */
  function getCalcSync(referenceDate?: Date): SolarCalcType {
    if (is.undefined(latitude) || is.undefined(longitude)) {
      throw new InternalError(context, "NO_LAT_LONG", "Race condition");
    }
    if (referenceDate) {
      // @ts-expect-error Typescript is wrong this time, this works as expected
      return new SolarCalc(referenceDate, latitude, longitude);
    }
    return SOLAR_CALC();
  }

  // protected async onModuleInit(): Promise<void> {
  //   const { lat, long } = await cache.get<CacheData>(SOLAR_CACHE, {
  //     lat: DEFAULT_POSITION,
  //     long: DEFAULT_POSITION,
  //   });
  //   longitude = long;
  //   latitude = lat;
  //   initScan();
  // }

  // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  // protected async updateCalculator(): Promise<void> {
  //   const calc = await getCalc();
  //   Object.values(SolarEvents)
  //     .sort((a, b) =>
  //       (calc[a] as Date).getTime() > (calc[b] as Date).getTime() ? UP : DOWN,
  //     )
  //     .forEach(key => waitForEvent(calc, key));
  // }

  // @OnEvent(SOCKET_READY)
  // protected updateConfig(): void {
  //   setTimeout(async () => {
  //     const config = await fetch.getConfig();
  //     latitude = config.latitude;
  //     longitude = config.longitude;
  //     await cache.set<CacheData>(SOLAR_CACHE, {
  //       lat: config.latitude,
  //       long: config.longitude,
  //     });
  //     updateCalculator();
  //   }, SECOND);
  // }

  function initScan(): void {
    scanner.bindMethodDecorator<SolarOptions>(
      SolarEvent,
      ({ exec, data, context }) => {
        logger.info({ name: context }, `[@SolarEvent] {%s}`, data);
        event.emit(SOLAR_EVENT_TRIGGER, {
          context,
          event: data,
        } as SolarEventTriggerData);
        const current = callbacks.get(data) ?? [];
        current.push(exec);
        callbacks.set(data, current);
      },
    );
  }

  async function waitForEvent(
    calc: typeof SolarCalc,
    key: `${SolarEvents}`,
  ): Promise<void> {
    if (!emit) {
      return;
    }
    if (dayjs().isAfter(calc[key])) {
      logger.debug(
        { name: key },
        `already fired for today {%s}`,
        (calc[key] as Date).toLocaleTimeString(),
      );
      return;
    }
    logger.info(
      { name: key },
      `will fire at {%s}`,
      (calc[key] as Date).toLocaleTimeString(),
    );
    const timer = new CronTime(calc[key]);
    await sleep(timer.getTimeout());
    const current = callbacks.get(key) ?? [];
    const wildcard = callbacks.get("*") ?? [];
    [current, wildcard].flat().forEach(callback => callback());
  }
}
