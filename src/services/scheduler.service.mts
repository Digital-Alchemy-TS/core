import { CronJob } from "cron";
import dayjs from "dayjs";

import type {
  RemoveCallback,
  SchedulerBuilder,
  SchedulerCronOptions,
  SchedulerIntervalOptions,
  SchedulerSlidingOptions,
  TBlackHole,
  TContext,
  TOffset,
  TServiceParams,
} from "../index.mts";
import { BootstrapException, sleep } from "../index.mts";

/**
 * Builder-style scheduler factory injected into every service via `TServiceParams`.
 *
 * @remarks
 * Returns a function that accepts a `TContext` and produces the per-caller scheduler
 * API (`cron`, `interval`, `sliding`, `setTimeout`, `setInterval`, `sleep`).
 * This two-level shape is deliberate: the outer factory sets up lifecycle hooks
 * shared across all callers; the inner function binds the per-caller context so
 * every scheduled callback is associated with the service that created it.
 *
 * All schedules are registered against a shared `stop` set so a single
 * `onPreShutdown` hook can cleanly cancel every outstanding timer in one pass.
 * Schedules only start firing after the `onReady` lifecycle event; creating a
 * scheduler before `onReady` is safe — the job is registered but does not run
 * until the application is ready.
 *
 * Remove callbacks returned from each method are dual-arity:
 * call them directly (`remove()`) or destructure `{ remove }` — both work.
 */
export function Scheduler({ logger, lifecycle, internal }: TServiceParams): SchedulerBuilder {
  const { is } = internal.utils;
  const stop = new Set<RemoveCallback>();

  // #MARK: lifecycle events
  lifecycle.onPreShutdown(function onPreShutdown() {
    // skip teardown work if nothing was ever scheduled for this instance
    if (is.empty(stop)) {
      return;
    }
    logger.info({ name: onPreShutdown }, `removing [%s] schedules`, stop.size);
    stop.forEach(stopFunctions => {
      stopFunctions();
      stop.delete(stopFunctions);
    });
  });

  return (context: TContext) => {
    // #MARK: cron
    /**
     * Run `exec` on one or more cron schedules.
     *
     * @remarks
     * Accepts a single schedule string or an array; each schedule creates an
     * independent `CronJob`. Jobs start on `onReady` and are registered in the
     * shared `stop` set so they are cancelled during `onPreShutdown`.
     * Returns a combined remove callback that cancels all jobs created by this call.
     */
    function cron({ exec, schedule: scheduleList }: SchedulerCronOptions) {
      const stopFunctions: RemoveCallback[] = [];
      [scheduleList].flat().forEach(cronSchedule => {
        logger.trace({ context, name: cron, schedule: cronSchedule }, `init`);
        const cronJob = new CronJob(cronSchedule, async () => await internal.safeExec(exec));
        lifecycle.onReady(() => {
          logger.trace({ context, name: cron, schedule: cronSchedule }, "starting");
          cronJob.start();
        });

        const stopFunction = internal.removeFn(() => {
          logger.trace({ context, name: cron, schedule: cronSchedule }, `stopping`);
          cronJob.stop();
        });

        stop.add(stopFunction);
        stopFunctions.push(stopFunction);
        return stopFunction;
      });

      // wrap all individual stop functions so a single call cancels every schedule
      return internal.removeFn(() => stopFunctions.forEach(stop => stop()));
    }

    // #MARK: interval
    /**
     * Run `exec` repeatedly at a fixed `interval` millisecond cadence.
     *
     * @remarks
     * The underlying `setInterval` does not start until `onReady`. If the
     * application is torn down before `onReady` fires the `stopped` guard
     * prevents the timer from being created at all.
     */
    function interval({ exec, interval }: SchedulerIntervalOptions) {
      let runningInterval: ReturnType<typeof setInterval>;
      lifecycle.onReady(() => {
        logger.trace({ context, name: interval }, "starting");
        runningInterval = setInterval(async () => await internal.safeExec(exec), interval);
      });
      const stopFunction = internal.removeFn(() => {
        if (runningInterval) {
          clearInterval(runningInterval);
        }
      });
      stop.add(stopFunction);
      return stopFunction;
    }

    // #MARK: sliding
    /**
     * Schedule an execution at a time determined dynamically by a `next` callback.
     *
     * @remarks
     * Unlike cron (fixed periods) or interval (fixed gaps), sliding lets the
     * caller compute the *exact* next run time. `reset` is a cron expression
     * that controls how often `next` is re-evaluated; `next` returns the target
     * `Dayjs` moment for the actual `exec` call.
     *
     * Decision points:
     * - If `next()` returns falsy the window is skipped — caller can signal
     *   "nothing to do right now" without throwing.
     * - If the computed time is already in the past at evaluation time, the
     *   execution is skipped. This most commonly happens on first boot when the
     *   slot has already passed for today; treating it as a no-op avoids an
     *   immediate double-fire.
     * - If `waitForNext` is called while a previous timeout is still pending,
     *   it cancels the old one and schedules fresh — ensures the schedule stays
     *   coherent if the reset cron fires more aggressively than expected.
     *
     * @throws {BootstrapException} `BAD_NEXT` if `next` or `exec` is not a function.
     */
    function sliding({ exec, reset, next }: SchedulerSlidingOptions) {
      if (!is.function(next)) {
        throw new BootstrapException(
          context,
          "BAD_NEXT",
          "Did not provide next function to schedule.sliding",
        );
      }
      if (!is.function(exec)) {
        throw new BootstrapException(
          context,
          "BAD_NEXT",
          "Did not provide exec function to schedule.sliding",
        );
      }
      let timeout: ReturnType<typeof setTimeout>;

      const waitForNext = () => {
        // a pending timeout means the reset cron fired before the scheduled exec ran;
        // cancel and reschedule so the next time is always freshly computed
        if (timeout) {
          logger.warn(
            { context, name: sliding },
            `sliding schedule retrieving next execution time before previous ran`,
          );
          clearTimeout(timeout);
        }
        let nextTime = next();
        // next() returning falsy is the caller's way of saying "skip this window"
        if (!nextTime) {
          logger.trace({ context, name: sliding }, "next returned falsy, skipping window");
          return;
        }
        nextTime = dayjs(nextTime);
        // if the target time is already past at evaluation, skip to avoid an immediate
        // double-fire; most common on first boot when the slot passed earlier today
        if (dayjs().isAfter(nextTime)) {
          logger.trace({ context, name: sliding }, "next time is in the past, skipping");
          return;
        }
        if (nextTime) {
          timeout = setTimeout(
            async () => {
              await internal.safeExec(exec);
            },
            Math.abs(dayjs().diff(nextTime, "ms")),
          );
        }
      };
      // reset on schedule
      const scheduleStop = cron({
        exec: waitForNext,
        schedule: reset,
      });
      // find value for now (boot)
      lifecycle.onReady(() => waitForNext());

      return internal.removeFn(() => {
        scheduleStop();
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
      });
    }

    /**
     * Fire `callback` once after `target` offset elapses.
     *
     * @remarks
     * Wraps the native `setTimeout` with lifecycle awareness: the timer is not
     * armed until `onReady`, and is automatically cancelled during shutdown via
     * the shared `stop` set. If `remove()` is called before `onReady` the
     * `stopped` flag prevents the timer from ever being created.
     */
    function SetTimeout(callback: () => TBlackHole, target: TOffset) {
      let timer: ReturnType<typeof setTimeout>;
      let stopped = false;
      lifecycle.onReady(() => {
        // guard against the case where remove() was called before onReady fired
        if (stopped) {
          return;
        }
        timer = setTimeout(async () => {
          stop.delete(remove);
          await internal.safeExec(callback);
        }, internal.utils.getIntervalMs(target));
      });
      const remove = internal.removeFn(() => {
        stopped = true;
        stop.delete(remove);
        if (timer) {
          clearTimeout(timer);
        }
      });
      stop.add(remove);
      return remove;
    }

    /**
     * Fire `callback` repeatedly at every `target` offset interval.
     *
     * @remarks
     * Lifecycle-aware wrapper around `setInterval`. Timer starts on `onReady`
     * and is cancelled during shutdown via the shared `stop` set. If `remove()`
     * is called before `onReady`, the `stopped` guard prevents the interval
     * from ever starting.
     */
    function SetInterval(callback: () => TBlackHole, target: TOffset) {
      let timer: ReturnType<typeof setInterval>;
      let stopped = false;
      lifecycle.onReady(() => {
        // guard against the case where remove() was called before onReady fired
        if (stopped) {
          return;
        }
        timer = setInterval(
          async () => await internal.safeExec(callback),
          internal.utils.getIntervalMs(target),
        );
      });
      const remove = internal.removeFn(() => {
        stopped = true;
        stop.delete(remove);
        if (timer) {
          clearInterval(timer);
        }
      });
      stop.add(remove);
      return remove;
    }

    return {
      cron,
      interval,
      setInterval: SetInterval,
      setTimeout: SetTimeout,
      sleep,
      sliding,
    };
  };
}
