import { is } from "../extensions/is.extension";

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

type SleepReturn = Promise<void> & {
  kill: (execute: "stop" | "continue") => void;
};
/**
 * Defaults to 1000 (1 second).
 *
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
export function sleep(target: number | Date = SECOND): SleepReturn {
  // done function from promise
  let done: undefined | (() => void);

  const timeout = setTimeout(
    () => done && done(),
    is.date(target) ? target.getTime() - Date.now() : target,
  );

  // Take a normal promise, add a `.kill` to it
  // You can await as normal, or call the function
  const out = new Promise<void>((i) => (done = i)) as SleepReturn;
  out.kill = (execute = "stop") => {
    if (execute === "continue") {
      done && done();
    }
    clearTimeout(timeout);
    done = undefined;
  };
  return out;
}

export const ACTIVE_THROTTLE = new Map<string, SleepReturn>();
export async function throttle(
  identifier: string,
  timeout: number,
): Promise<void> {
  const current = ACTIVE_THROTTLE.get(identifier);
  if (current) {
    current.kill("stop");
  }
  const delay = sleep(timeout);
  ACTIVE_THROTTLE.set(identifier, delay);
  await delay;
  ACTIVE_THROTTLE.delete(identifier);
}

export const asyncNoop = async () => await sleep(NONE);
export const noop = () => {};

/**
 * #MARK: (re)peat
 *
 * Create an array of length, where the values are filled with a provided fill value, or (index + 1) as default value
 */
export function PEAT<T = number>(length: number, fill?: T): T[] {
  return Array.from({ length }).map(
    (_, index) => fill ?? ((index + ARRAY_OFFSET) as T),
  );
}

export type TBlackHole = unknown | void | Promise<void>;
export type TAnyFunction = (...data: unknown[]) => TBlackHole;
