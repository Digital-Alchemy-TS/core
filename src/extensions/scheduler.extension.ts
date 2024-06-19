/* eslint-disable sonarjs/cognitive-complexity */
import dayjs, { Dayjs } from "dayjs";
import { schedule } from "node-cron";

import { is, TBlackHole, TContext } from "..";
import {
  BootstrapException,
  Schedule,
  SCHEDULE_ERRORS,
  SCHEDULE_EXECUTION_COUNT,
  SCHEDULE_EXECUTION_TIME,
  SchedulerOptions,
  TServiceParams,
} from "../helpers";

export function Scheduler({ logger, lifecycle, internal }: TServiceParams) {
  const stop = new Set<() => TBlackHole>();

  // #MARK: lifecycle events
  lifecycle.onPreShutdown(() => {
    if (is.empty(stop)) {
      return;
    }
    logger.info(
      { name: "onPreShutdown" },
      `removing [%s] schedules`,
      stop.size,
    );
    stop.forEach((stopFunctions) => {
      stopFunctions();
      stop.delete(stopFunctions);
    });
  });

  return (context: TContext) => {
    // #MARK: node-cron
    function cron({
      exec,
      schedule: scheduleList,
      label,
    }: SchedulerOptions & { schedule: Schedule | Schedule[] }) {
      const stopFunctions: (() => TBlackHole)[] = [];
      [scheduleList].flat().forEach((cronSchedule) => {
        logger.trace(
          { context, label, name: cron, schedule: cronSchedule },
          `init`,
        );
        const cronJob = schedule(
          cronSchedule,
          async () =>
            await internal.safeExec({
              duration: SCHEDULE_EXECUTION_TIME,
              errors: SCHEDULE_ERRORS,
              exec,
              executions: SCHEDULE_EXECUTION_COUNT,
              labels: { context, label },
            }),
        );
        lifecycle.onReady(() => {
          logger.trace(
            { context, name: cron, schedule: cronSchedule },
            "starting",
          );
          cronJob.start();
        });

        const stopFunction = () => {
          logger.trace(
            { context, label, name: cron, schedule: cronSchedule },
            `stopping`,
          );
          cronJob.stop();
        };

        stop.add(stopFunction);
        stopFunctions.push(stopFunction);
        return stopFunction;
      });

      return () => stopFunctions.forEach((stop) => stop());
    }

    // #MARK: setInterval
    function interval({
      exec,
      interval,
      label,
    }: SchedulerOptions & { interval: number }) {
      let runningInterval: ReturnType<typeof setInterval>;
      lifecycle.onReady(() => {
        logger.trace({ context, name: "interval" }, "starting");

        runningInterval = setInterval(
          async () =>
            await internal.safeExec({
              duration: SCHEDULE_EXECUTION_TIME,
              errors: SCHEDULE_ERRORS,
              exec,
              executions: SCHEDULE_EXECUTION_COUNT,
              labels: { context, label },
            }),
          interval,
        );
      });
      const stopFunction = () => {
        if (runningInterval) {
          clearInterval(runningInterval);
        }
      };
      stop.add(stopFunction);
      return stopFunction;
    }

    // #MARK: sliding
    function sliding({
      exec,
      reset,
      next,
      label,
    }: SchedulerOptions & {
      /**
       * How often to run the `next` method, to retrieve the next scheduled execution time
       */
      reset: Schedule;
      /**
       * Return something time like. undefined = skip next
       */
      next: () => Dayjs | string | number | Date | undefined;
    }) {
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
        if (timeout) {
          logger.warn(
            { context, name: sliding },
            `sliding schedule retrieving next execution time before previous ran`,
          );
          clearTimeout(timeout);
        }
        let nextTime = next();
        if (!nextTime) {
          // nothing to do?
          // will try again next schedule
          return;
        }
        nextTime = dayjs(nextTime);
        if (dayjs().isAfter(nextTime)) {
          // probably a result of boot
          // ignore
          return;
        }
        if (nextTime) {
          timeout = setTimeout(
            async () => {
              await internal.safeExec({
                duration: SCHEDULE_EXECUTION_TIME,
                errors: SCHEDULE_ERRORS,
                exec,
                executions: SCHEDULE_EXECUTION_COUNT,
                labels: { context, label },
              });
            },
            Math.abs(dayjs().diff(nextTime, "ms")),
          );
        }
      };
      // reset on schedule
      const scheduleStop = cron({
        exec: waitForNext,
        label,
        schedule: reset,
      });
      // find value for now (boot)
      lifecycle.onReady(() => waitForNext());

      return () => {
        scheduleStop();
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
      };
    }

    // #MARK: return object
    return {
      cron,
      interval,
      sliding,
    };
  };
}
