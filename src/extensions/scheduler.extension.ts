/* eslint-disable sonarjs/cognitive-complexity */
import dayjs, { Dayjs } from "dayjs";
import { schedule } from "node-cron";

import { TBlackHole, TContext } from "..";
import {
  Schedule,
  SCHEDULE_ERRORS,
  SCHEDULE_EXECUTION_COUNT,
  SCHEDULE_EXECUTION_TIME,
  SchedulerOptions,
  TServiceParams,
} from "../helpers";

export function Scheduler({ logger, lifecycle, internal }: TServiceParams) {
  const stop = new Set<() => TBlackHole>();

  lifecycle.onShutdownStart(() => {
    stop.forEach((stopFunctions) => {
      stopFunctions();
      stop.delete(stopFunctions);
    });
  });

  return (context: TContext) => {
    // node-cron
    function cron({
      exec,
      schedule: scheduleList,
      label,
    }: SchedulerOptions & { schedule: Schedule | Schedule[] }) {
      const stopFunctions: (() => TBlackHole)[] = [];
      [scheduleList].flat().forEach((cronSchedule) => {
        logger.trace(
          { context, label, schedule: cronSchedule },
          `start schedule`,
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
          logger.trace({ context, schedule: cronSchedule }, "start cron");
          cronJob.start();
        });

        const stopFunction = () => {
          logger.trace(
            { context, label, schedule: cronSchedule },
            `stop schedule`,
          );
          cronJob.stop();
        };

        stop.add(stopFunction);
        stopFunctions.push(stopFunction);
        return stopFunction;
      });

      return () => stopFunctions.forEach((stop) => stop());
    }

    // setInterval
    function interval({
      exec,
      interval,
      label,
    }: SchedulerOptions & { interval: number }) {
      let runningInterval: ReturnType<typeof setInterval>;
      lifecycle.onReady(() => {
        logger.trace({ context }, "start interval");

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
      const scheduleStop = cron({
        exec: () => {
          if (timeout) {
            logger.warn(
              { context },
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
            logger.warn(
              { nextTime: nextTime.toISOString() },
              `cannot schedule sliding schedules for the past`,
            );
            // or anything else really
            // life sucks that way
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
        },
        label,
        schedule: reset,
      });

      let timeout: ReturnType<typeof setTimeout>;

      return () => {
        scheduleStop();
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
      };
    }

    return {
      cron,
      interval,
      sliding,
    };
  };
}
