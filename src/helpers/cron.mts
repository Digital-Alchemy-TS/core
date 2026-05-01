/**
 * Scheduler types and cron expression constants.
 *
 * @remarks
 * Provides a comprehensive set of cron expressions for common scheduling patterns
 * (second, minute, hour, day, week, month, year), three scheduler options types
 * (cron, interval, sliding), and type definitions for time offsets and the
 * scheduler service interface.
 */

import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { Duration, DurationUnitsObjectType, DurationUnitType } from "dayjs/plugin/duration.js";
import duration from "dayjs/plugin/duration.js";

import type { RemoveCallback } from "../index.mts";
import type { TContext } from "./context.mts";
import type { SleepReturn, TBlackHole } from "./utilities.mts";
import type { Schedule, SchedulerOptions } from "./wiring.mts";
dayjs.extend(duration);

/**
 * Predefined cron expressions for common scheduling patterns.
 *
 * @remarks
 * Each constant is a cron expression string (6-field format: second minute hour
 * dayOfMonth month dayOfWeek) that can be passed to `scheduler.cron(...)`.
 * Expressions range from sub-second (EVERY_SECOND) to yearly (EVERY_YEAR),
 * with specific business hours and weekday patterns included.
 *
 * @example
 * ```typescript
 * scheduler.cron({ exec: dailyTask, schedule: CronExpression.EVERY_DAY_AT_NOON });
 * scheduler.cron({ exec: weeklyTask, schedule: CronExpression.EVERY_WEEKDAY });
 * ```
 */
export enum CronExpression {
  // sub-minute
  EVERY_SECOND = "* * * * * *",
  EVERY_5_SECONDS = "*/5 * * * * *",
  EVERY_10_SECONDS = "*/10 * * * * *",
  EVERY_30_SECONDS = "*/30 * * * * *",
  // minute
  EVERY_MINUTE = "*/1 * * * *",
  EVERY_5_MINUTES = "0 */5 * * * *",
  EVERY_10_MINUTES = "0 */10 * * * *",
  EVERY_30_MINUTES = "0 */30 * * * *",
  // hour
  EVERY_HOUR = "0 0-23/1 * * *",
  EVERY_2_HOURS = "0 */2 * * *",
  EVERY_2ND_HOUR = "0 */2 * * *",
  EVERY_2ND_HOUR_FROM_1AM_THROUGH_11PM = "0 1-23/2 * * *",
  EVERY_3_HOURS = "0 0-23/3 * * *",
  EVERY_4_HOURS = "0 0-23/4 * * *",
  EVERY_5_HOURS = "0 0-23/5 * * *",
  EVERY_6_HOURS = "0 0-23/6 * * *",
  EVERY_7_HOURS = "0 0-23/7 * * *",
  EVERY_8_HOURS = "0 0-23/8 * * *",
  EVERY_9_HOURS = "0 0-23/9 * * *",
  EVERY_10_HOURS = "0 0-23/10 * * *",
  EVERY_11_HOURS = "0 0-23/11 * * *",
  EVERY_12_HOURS = "0 0-23/12 * * *",
  // day (specific times)
  EVERY_DAY_AT_1AM = "0 01 * * *",
  EVERY_DAY_AT_2AM = "0 02 * * *",
  EVERY_DAY_AT_3AM = "0 03 * * *",
  EVERY_DAY_AT_4AM = "0 04 * * *",
  EVERY_DAY_AT_5AM = "0 05 * * *",
  EVERY_DAY_AT_6AM = "0 06 * * *",
  EVERY_DAY_AT_7AM = "0 07 * * *",
  EVERY_DAY_AT_8AM = "0 08 * * *",
  EVERY_DAY_AT_9AM = "0 09 * * *",
  EVERY_DAY_AT_10AM = "0 10 * * *",
  EVERY_DAY_AT_11AM = "0 11 * * *",
  EVERY_DAY_AT_NOON = "0 12 * * *",
  EVERY_DAY_AT_1PM = "0 13 * * *",
  EVERY_DAY_AT_2PM = "0 14 * * *",
  EVERY_DAY_AT_3PM = "0 15 * * *",
  EVERY_DAY_AT_4PM = "0 16 * * *",
  EVERY_DAY_AT_5PM = "0 17 * * *",
  EVERY_DAY_AT_6PM = "0 18 * * *",
  EVERY_DAY_AT_7PM = "0 19 * * *",
  EVERY_DAY_AT_8PM = "0 20 * * *",
  EVERY_DAY_AT_9PM = "0 21 * * *",
  EVERY_DAY_AT_10PM = "0 22 * * *",
  EVERY_DAY_AT_11PM = "0 23 * * *",
  EVERY_DAY_AT_MIDNIGHT = "0 0 * * *",
  // week
  EVERY_WEEK = "0 0 * * 0",
  EVERY_WEEKDAY = "0 0 * * 1-5",
  EVERY_WEEKEND = "0 0 * * 6,0",
  // month
  EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT = "0 0 1 * *",
  EVERY_1ST_DAY_OF_MONTH_AT_NOON = "0 12 1 * *",
  EVERY_2ND_MONTH = "0 0 1 */2 *",
  EVERY_QUARTER = "0 0 1 */3 *",
  EVERY_6_MONTHS = "0 0 1 */6 *",
  // business hours
  EVERY_30_MINUTES_BETWEEN_9AM_AND_5PM = "0 */30 9-17 * * *",
  EVERY_30_MINUTES_BETWEEN_9AM_AND_6PM = "0 */30 9-18 * * *",
  EVERY_30_MINUTES_BETWEEN_10AM_AND_7PM = "0 */30 10-19 * * *",
  // weekday-specific times
  MONDAY_TO_FRIDAY_AT_1AM = "0 0 01 * * 1-5",
  MONDAY_TO_FRIDAY_AT_2AM = "0 0 02 * * 1-5",
  MONDAY_TO_FRIDAY_AT_3AM = "0 0 03 * * 1-5",
  MONDAY_TO_FRIDAY_AT_4AM = "0 0 04 * * 1-5",
  MONDAY_TO_FRIDAY_AT_5AM = "0 0 05 * * 1-5",
  MONDAY_TO_FRIDAY_AT_6AM = "0 0 06 * * 1-5",
  MONDAY_TO_FRIDAY_AT_7AM = "0 0 07 * * 1-5",
  MONDAY_TO_FRIDAY_AT_8AM = "0 0 08 * * 1-5",
  MONDAY_TO_FRIDAY_AT_9AM = "0 0 09 * * 1-5",
  MONDAY_TO_FRIDAY_AT_09_30AM = "0 30 09 * * 1-5",
  MONDAY_TO_FRIDAY_AT_10AM = "0 0 10 * * 1-5",
  MONDAY_TO_FRIDAY_AT_11AM = "0 0 11 * * 1-5",
  MONDAY_TO_FRIDAY_AT_11_30AM = "0 30 11 * * 1-5",
  MONDAY_TO_FRIDAY_AT_12PM = "0 0 12 * * 1-5",
  MONDAY_TO_FRIDAY_AT_1PM = "0 0 13 * * 1-5",
  MONDAY_TO_FRIDAY_AT_2PM = "0 0 14 * * 1-5",
  MONDAY_TO_FRIDAY_AT_3PM = "0 0 15 * * 1-5",
  MONDAY_TO_FRIDAY_AT_4PM = "0 0 16 * * 1-5",
  MONDAY_TO_FRIDAY_AT_5PM = "0 0 17 * * 1-5",
  MONDAY_TO_FRIDAY_AT_6PM = "0 0 18 * * 1-5",
  MONDAY_TO_FRIDAY_AT_7PM = "0 0 19 * * 1-5",
  MONDAY_TO_FRIDAY_AT_8PM = "0 0 20 * * 1-5",
  MONDAY_TO_FRIDAY_AT_9PM = "0 0 21 * * 1-5",
  MONDAY_TO_FRIDAY_AT_10PM = "0 0 22 * * 1-5",
  MONDAY_TO_FRIDAY_AT_11PM = "0 0 23 * * 1-5",
  // year
  EVERY_YEAR = "0 0 1 1 *",
}

/**
 * Schedule type identifier for cron-based schedules.
 *
 * @internal
 */
export const CRON_SCHEDULE = "CRON_SCHEDULE";

/**
 * Schedule type identifier for interval-based schedules.
 *
 * @internal
 */
export const INTERVAL_SCHEDULE = "INTERVAL_SCHEDULE";

/**
 * Options for a cron-based scheduled task.
 *
 * @remarks
 * Extends `SchedulerOptions` with a `schedule` field that accepts one or more
 * cron expressions (or `CronExpression` enum values). Multiple schedules will
 * trigger the callback at the union of all specified times.
 */
export type SchedulerCronOptions = SchedulerOptions & {
  /** Cron expression(s) — single or array — determining execution times. */
  schedule: Schedule | Schedule[];
};

/**
 * Options for an interval-based scheduled task.
 *
 * @remarks
 * Extends `SchedulerOptions` with an `interval` field specifying the time
 * between executions (in milliseconds or a `TOffset` specification).
 */
export type SchedulerIntervalOptions = SchedulerOptions & {
  /** Time between executions, in milliseconds. */
  interval: number;
};

/**
 * Options for a sliding-window scheduled task.
 *
 * @remarks
 * Executes on a computed schedule: the `reset` cron determines how often to
 * call the `next()` function to retrieve the next execution time. If `next()`
 * returns a valid time (Dayjs, Date, number, or string), a timeout is set for
 * that time; undefined means skip this iteration. Useful for event-driven or
 * data-dependent scheduling.
 */
export type SchedulerSlidingOptions = SchedulerOptions & {
  /**
   * Cron expression determining how often to recompute the next execution time.
   *
   * @remarks
   * The `next()` callback is invoked on this schedule; its return value is
   * used to compute the actual execution time.
   */
  reset: Schedule;

  /**
   * Compute the next execution time.
   *
   * @remarks
   * Called on the `reset` schedule; return a time-like value to execute,
   * or undefined to skip this iteration.
   */
  next: () => Dayjs | string | number | Date | undefined;
};

/**
 * Scheduler service interface — methods to schedule and execute tasks.
 *
 * @remarks
 * Returned by the scheduler service factory after context binding. Provides
 * four primary scheduling methods (cron, interval, sliding, setTimeout/setInterval)
 * and a sleep utility. All methods return a `RemoveCallback` to cancel the
 * scheduled task.
 */
export type DigitalAlchemyScheduler = {
  /**
   * Schedule a task on a cron expression.
   *
   * @remarks
   * Accepts one or more cron schedules (or `CronExpression` constants) and
   * executes the callback at matching times. Returns a function to remove
   * the scheduled task.
   */
  cron: (options: SchedulerCronOptions) => RemoveCallback;

  /**
   * Schedule a task with a dynamically computed execution time.
   *
   * @remarks
   * On the `reset` schedule, calls the `next()` function to determine the next
   * execution time. If `next()` returns a valid time, schedules execution; if
   * undefined, skips. Useful for event-triggered or data-dependent scheduling.
   */
  sliding: (options: SchedulerSlidingOptions) => RemoveCallback;

  /**
   * Schedule a task to run repeatedly at a fixed interval.
   *
   * @remarks
   * Executes the callback after the first interval, then repeats. Useful for
   * background polling or periodic maintenance tasks.
   */
  setInterval: (callback: () => TBlackHole, target: TOffset) => RemoveCallback;

  /**
   * Schedule a task to run once after a delay.
   *
   * @remarks
   * Executes the callback once after the specified time offset has elapsed.
   * Useful for deferred operations or delayed initialization.
   */
  setTimeout: (callback: () => TBlackHole, target: TOffset) => RemoveCallback;

  /**
   * Create a promise that resolves after a delay.
   *
   * @remarks
   * Useful for awaiting a time offset in async code, or for testing. The
   * returned promise is cancellable via its `cancel()` method.
   */
  sleep: (target: TOffset | Date | Dayjs) => SleepReturn;
};

/**
 * Scheduler factory function — binds context and returns the scheduler API.
 *
 * @remarks
 * Called by the wiring engine with the request context; returns an object
 * with all scheduling methods. This pattern allows per-request context
 * binding without polluting the DI injection signature.
 */
export type SchedulerBuilder = (context: TContext) => DigitalAlchemyScheduler;

/**
 * ISO 8601 partial duration string type for flexible time offset specification.
 *
 * @remarks
 * Examples: "1h", "30m", "45s", "1h30m45s". Used alongside `DurationUnitsObjectType`
 * and numeric offsets to specify time values in scheduler methods.
 *
 * @internal
 */
type Part<CHAR extends string> = `${number}${CHAR}` | "";
type ISO_8601_PARTIAL = Exclude<`${Part<"H" | "h">}${Part<"M" | "m">}${Part<"S" | "s">}`, "">;

/**
 * Union of supported time offset representations.
 *
 * @remarks
 * Can be a dayjs Duration, milliseconds (number), an object with duration units,
 * an ISO 8601 partial string, or a tuple of [quantity, unit]. Scheduler methods
 * accept any of these formats and normalize them internally.
 */
export type OffsetTypes =
  | Duration
  | number
  | DurationUnitsObjectType
  | ISO_8601_PARTIAL
  | [quantity: number, unit: DurationUnitType];

/**
 * Time offset — either a static value or a function that returns one.
 *
 * @remarks
 * Allows dynamic offset computation at execution time. Useful for tests or
 * when the delay depends on runtime state.
 */
export type TOffset = OffsetTypes | (() => OffsetTypes);
