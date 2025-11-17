import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { Duration, DurationUnitsObjectType } from "dayjs/plugin/duration";
import duration from "dayjs/plugin/duration";

import { is } from "../index.mts";
import type { TOffset } from "./cron.mts";

dayjs.extend(duration);

/* eslint-disable @typescript-eslint/no-magic-numbers */
export const EVEN = 2;
export const PAIR = 2;
export const HALF = 0.5;
export const ONE_THIRD = 1 / 3;
export const TWO_THIRDS = 2 / 3;
/**
 * Good for a surprising number of situations
 */
export const DEFAULT_LIMIT = 5;
export const INVERT_VALUE = -1;
// Sort
export const UP = 1;
// [LABEL,VALUE]
export const VALUE = 1;
// Standard value
export const ARRAY_OFFSET = 1;
// array[number +- increment]
export const INCREMENT = 1;
// Generic one-ness
export const SINGLE = 1;
// Sorting
export const SAME = 0;
// [LABEL,VALUE]
export const LABEL = 0;
// Generic start of something
export const START = 0;
export const NONE = 0;
export const FIRST = 0;
export type FIRST = 0;
export const EMPTY = 0;
export const NO_CHANGE = 0;

// Testing of indexes
export const NOT_FOUND = -1;
// Sorting
export const DOWN = -1;
export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const WEEK = 7 * DAY;
export const SECOND = 1000;
export const PERCENT = 100;
export const YEAR = 365 * DAY;

export const ACTIVE_SLEEPS = new Set<SleepReturn>();

/**
 * Converts a TOffset to a Duration object (or undefined if invalid)
 * Handles function unwrapping, arrays, objects, strings, and numbers
 */
export function toOffsetDuration(offset: TOffset): Duration | undefined {
  // If function, unwrap
  if (is.function(offset)) {
    offset = offset();
  }
  // If tuple, resolve
  if (is.array(offset)) {
    const [amount, unit] = offset;
    return dayjs.duration(amount, unit);
  }
  // Resolve objects, or capture Duration
  if (is.object(offset)) {
    return dayjs.isDuration(offset)
      ? (offset as Duration)
      : dayjs.duration(offset as DurationUnitsObjectType);
  }
  // Resolve from partial ISO 8601
  if (is.string(offset)) {
    return dayjs.duration(`PT${offset.toUpperCase()}`);
  }
  // ms - number
  if (is.number(offset)) {
    return dayjs.duration(offset, "ms");
  }
  return undefined;
}

/**
 * Converts a TOffset to milliseconds
 */
export function toOffsetMs(offset: TOffset): number {
  // If function, unwrap
  if (is.function(offset)) {
    offset = offset();
  }
  // If it's a number, return directly (optimization - no need to create duration)
  if (is.number(offset)) {
    return offset;
  }
  // Otherwise, convert to duration and get milliseconds
  const duration = toOffsetDuration(offset);
  return duration?.asMilliseconds() ?? NONE;
}

export type SleepReturn = Promise<void> & {
  kill: (execute?: "stop" | "continue") => void;
};
/**
 * #MARK: Simple usage
 *
 * ```typescript
 * await sleep(5000);
 * ```
 *
 * #MARK: Early stop
 *
 * ```typescript
 * const start = Date.now();
 * const timer = sleep(5000);
 * setTimeout(() => timer.kill("continue"),1000);
 * await timer;
 * const end = Date.now();
 * console.log(end - start); // 1000, because we stopped it early and executed
 * ```
 */
export function sleep(target: TOffset | Date | Dayjs): SleepReturn {
  // done function from promise
  let done: undefined | (() => void);

  const getTimeoutMs = (): number => {
    // Handle Date - absolute time
    if (is.date(target)) {
      return target.getTime() - Date.now();
    }
    // Handle Dayjs - absolute time
    if (is.dayjs(target)) {
      return target.valueOf() - Date.now();
    }
    // Handle TOffset - duration/offset
    return toOffsetMs(target);
  };

  const timeout = setTimeout(() => {
    if (done) {
      done();
    }
    ACTIVE_SLEEPS.delete(out);
  }, getTimeoutMs());

  // Take a normal promise, add a `.kill` to it
  // You can await as normal, or call the function
  const out = new Promise<void>(i => (done = i)) as SleepReturn;
  ACTIVE_SLEEPS.add(out);
  out.kill = (execute = "stop") => {
    ACTIVE_SLEEPS.delete(out);
    if (execute === "continue" && done) {
      done();
    }
    clearTimeout(timeout);
    done = undefined;
  };
  return out;
}

export const ACTIVE_THROTTLE = new Set<string>();
export const ACTIVE_DEBOUNCE = new Map<string, SleepReturn>();

/**
 * wait for duration after call before allowing next, extends for calls inside window
 */
export async function debounce(identifier: string, timeout: TOffset): Promise<void> {
  const current = ACTIVE_DEBOUNCE.get(identifier);
  if (!is.undefined(current)) {
    current.kill("stop");
  }
  const delay = sleep(timeout);
  ACTIVE_DEBOUNCE.set(identifier, delay);
  await delay;
  ACTIVE_DEBOUNCE.delete(identifier);
}

export const asyncNoop = async () => await sleep(NONE);
export const noop = () => {};

export type TBlackHole = unknown | void | Promise<void>;
export type TAnyFunction = (...data: unknown[]) => TBlackHole;
