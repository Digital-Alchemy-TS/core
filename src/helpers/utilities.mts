import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { Duration, DurationUnitsObjectType } from "dayjs/plugin/duration.js";
import duration from "dayjs/plugin/duration.js";

import { is } from "../index.mts";
import type { TOffset } from "./cron.mts";

dayjs.extend(duration);

/* eslint-disable @typescript-eslint/no-magic-numbers */

// --- Numeric constants ---------------------------------------------------------
// These are the canonical zero/one anchors used throughout the codebase.
// Named constants eliminate magic numbers and make intent explicit at each
// call site, which is why they live here rather than being inlined.

/** Even divisor — used when checking parity (`value % EVEN === 0`). */
export const EVEN = 2;

/** Alias for EVEN; used when the "twoness" is conceptually a pair, not parity. */
export const PAIR = 2;

/** Multiplier for half of a value (`total * HALF`). */
export const HALF = 0.5;

/** One-third fraction constant (`total * ONE_THIRD`). */
export const ONE_THIRD = 1 / 3;

/** Two-thirds fraction constant (`total * TWO_THIRDS`). */
export const TWO_THIRDS = 2 / 3;

/**
 * Sensible default cap for concurrency and pagination limits.
 *
 * Good for a surprising number of situations
 */
export const DEFAULT_LIMIT = 5;

/** Multiply by this to negate a number (`value * INVERT_VALUE`). */
export const INVERT_VALUE = -1;

/** Sort comparator return for ascending order (`a > b ? UP : ...`). */
// Sort
export const UP = 1;

/** Index of the value element in a `[label, value]` tuple. */
// [LABEL,VALUE]
export const VALUE = 1;

/**
 * Offset applied when converting a 1-based length to a 0-based last index
 * (`array.length - ARRAY_OFFSET`).
 */
// Standard value
export const ARRAY_OFFSET = 1;

/** Step size when walking an array index one position at a time. */
// array[number +- increment]
export const INCREMENT = 1;

/** Canonical "one of something" constant; avoids the bare literal `1`. */
// Generic one-ness
export const SINGLE = 1;

/** Sort comparator return for equal elements (`a === b ? SAME : ...`). */
// Sorting
export const SAME = 0;

/** Index of the label element in a `[label, value]` tuple. */
// [LABEL,VALUE]
export const LABEL = 0;

/** Zero-based start index; use instead of bare `0` for array access. */
// Generic start of something
export const START = 0;

/** Canonical zero-count sentinel (`if (count === NONE)`). */
export const NONE = 0;

/** First index in any zero-based collection. */
export const FIRST = 0;

/** Type alias for the literal `0`; useful in discriminated union positions. */
export type FIRST = 0;

/** Zero-length sentinel; use `length === EMPTY` instead of `length === 0`. */
export const EMPTY = 0;

/** No-op delta — returned from comparators when a value has not changed. */
export const NO_CHANGE = 0;

/** Sentinel returned by `Array.prototype.indexOf` when the element is absent. */
// Testing of indexes
export const NOT_FOUND = -1;

/** Sort comparator return for descending order (`a < b ? DOWN : ...`). */
// Sorting
export const DOWN = -1;

/** One minute expressed in milliseconds (`60_000`). */
export const MINUTE = 60_000;

/** One hour expressed in milliseconds (`3_600_000`). */
export const HOUR = 3_600_000;

/** One day expressed in milliseconds (`86_400_000`). */
export const DAY = 86_400_000;

/** One week expressed in milliseconds (`7 * DAY`). */
export const WEEK = 7 * DAY;

/** One second expressed in milliseconds (`1_000`). */
export const SECOND = 1000;

/** Denominator for percent calculations (`value / PERCENT * 100`). */
export const PERCENT = 100;

/** One calendar year expressed in milliseconds (`365 * DAY`). */
export const YEAR = 365 * DAY;

// --- Sleep infrastructure -----------------------------------------------------

/**
 * Live set of every `SleepReturn` that has not yet resolved or been killed.
 *
 * @remarks
 * The scheduler and teardown logic iterate this set to cancel in-flight sleeps
 * on shutdown. Entries are added when `sleep()` is called and removed when the
 * timer fires or `.kill()` is called.
 *
 * @internal
 */
export const ACTIVE_SLEEPS = new Set<SleepReturn>();

/**
 * Normalise a {@link TOffset} into a dayjs `Duration` object.
 *
 * @remarks
 * Supports the full `TOffset` union:
 * - **function** — called first to unwrap the real offset
 * - **`[amount, unit]` tuple** — passed directly to `dayjs.duration`
 * - **`DurationUnitsObjectType` object** — passed to `dayjs.duration`; an existing
 *   `Duration` instance is returned as-is
 * - **string** — interpreted as a partial ISO 8601 duration after prepending `"PT"`
 *   (e.g. `"30s"` → `"PT30S"`)
 * - **number** — treated as raw milliseconds
 *
 * Returns `undefined` when the offset does not match any supported form.
 *
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
 * Normalise a {@link TOffset} into a plain millisecond count.
 *
 * @remarks
 * Unwraps function offsets then takes a fast path for raw numbers to avoid
 * allocating a `Duration` object. All other forms are delegated to
 * {@link toOffsetDuration} and converted via `asMilliseconds()`.
 *
 * Returns `NONE` (0) when the offset cannot be resolved.
 *
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

/**
 * A `Promise<void>` extended with a `.kill()` method for early cancellation.
 *
 * @remarks
 * Returned by {@link sleep}. Awaiting resolves when the timer fires naturally.
 * Calling `.kill("continue")` resolves the promise immediately and cancels the
 * timer. Calling `.kill("stop")` (the default) cancels the timer and lets the
 * promise remain forever-pending — useful when you want the awaiting code to
 * simply stop without advancing.
 */
export type SleepReturn = Promise<void> & {
  kill: (execute?: "stop" | "continue") => void;
};

/**
 * Async delay that supports early cancellation via `.kill()`.
 *
 * @remarks
 * Accepts any {@link TOffset}, a JS `Date`, or a `Dayjs` instance. Absolute
 * time values (`Date` / `Dayjs`) are converted to a relative delay from now at
 * the moment `sleep()` is called.
 *
 * The returned {@link SleepReturn} is tracked in {@link ACTIVE_SLEEPS} for
 * lifecycle-aware shutdown; it is removed automatically when the timer fires or
 * `.kill()` is called.
 *
 * @example Simple usage
 * ```typescript
 * await sleep(5000);
 * ```
 *
 * @example Early stop
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
    // only resolve the promise when the caller wants execution to continue after the kill
    if (execute === "continue" && done) {
      done();
    }
    clearTimeout(timeout);
    done = undefined;
  };
  return out;
}

// --- Debounce infrastructure --------------------------------------------------

/**
 * Set of identifiers currently in the throttle window.
 *
 * @internal
 */
export const ACTIVE_THROTTLE = new Set<string>();

/**
 * Map of identifier → pending sleep for the active debounce window.
 *
 * @remarks
 * Each key is a caller-supplied `identifier` string. When a new call arrives
 * for an existing identifier, the current sleep is killed and replaced, pushing
 * the expiry forward. Entries are removed once the delay resolves.
 *
 * @internal
 */
export const ACTIVE_DEBOUNCE = new Map<string, SleepReturn>();

/**
 * Debounce an async operation by identifier.
 *
 * @remarks
 * Each call resets the timer for `identifier`, so the operation does not
 * proceed until no further calls for that identifier arrive within `timeout`.
 * Multiple concurrent callers sharing the same `identifier` all wait on the
 * same sliding window — the last writer wins.
 *
 * wait for duration after call before allowing next, extends for calls inside window
 */
export async function debounce(identifier: string, timeout: TOffset): Promise<void> {
  const current = ACTIVE_DEBOUNCE.get(identifier);
  // kill the outstanding timer so the window slides forward from this call
  if (!is.undefined(current)) {
    current.kill("stop");
  }
  const delay = sleep(timeout);
  ACTIVE_DEBOUNCE.set(identifier, delay);
  await delay;
  ACTIVE_DEBOUNCE.delete(identifier);
}

/** Async no-op that resolves after one event-loop tick via `sleep(0)`. */
export const asyncNoop = async () => await sleep(NONE);

/** Synchronous no-op — a named empty function for use as a default callback. */
export const noop = () => {};

/**
 * Represents a return type that callers are not expected to use.
 *
 * @remarks
 * Used as the return type annotation for fire-and-forget callbacks and service
 * methods where the resolved value is intentionally discarded. Covers `void`,
 * `Promise<void>`, and any other return to prevent TypeScript from complaining
 * about unused return values.
 */
export type TBlackHole = unknown | void | Promise<void>;

/** Loose function signature that accepts any arguments and returns a {@link TBlackHole}. */
export type TAnyFunction = (...data: unknown[]) => TBlackHole;
