/* eslint-disable sonarjs/cognitive-complexity */
import { TBlackHole, ZCC } from "@zcc/utilities";
import { CronJob } from "cron";
import dayjs, { Dayjs } from "dayjs";

import {
  Schedule,
  SCHEDULE_ERRORS,
  SCHEDULE_EXECUTION_COUNT,
  SCHEDULE_EXECUTION_TIME,
  SchedulerOptions,
  TServiceParams,
} from "../helpers/index";

export function ZCC_Scheduler({ logger, lifecycle }: TServiceParams) {
  const stop = new Set<() => TBlackHole>();

  lifecycle.onShutdownStart(() => {
    stop.forEach(stopFunctions => {
      stopFunctions();
      stop.delete(stopFunctions);
    });
  });

  // node-cron
  function cron({
    context,
    exec,
    schedule,
    label,
  }: SchedulerOptions & { schedule: Schedule | Schedule[] }) {
    const stopFunctions: (() => TBlackHole)[] = [];
    [schedule].flat().forEach(schedule => {
      logger.debug({ context, label, schedule }, `starting schedule`);
      const cronJob = new CronJob(
        schedule,
        async () =>
          await ZCC.safeExec({
            duration: SCHEDULE_EXECUTION_TIME,
            errors: SCHEDULE_ERRORS,
            exec,
            executions: SCHEDULE_EXECUTION_COUNT,
            labels: { context, label },
          }),
      );
      lifecycle.onReady(() => cronJob.start());

      const stopFunction = () => {
        logger.debug({ context, label, schedule }, `stopping schedule`);
        cronJob.stop();
      };

      stop.add(stopFunction);
      stopFunctions.push(stopFunction);
      return stopFunction;
    });

    return () => stopFunctions.forEach(stop => stop());
  }

  // setInterval
  function interval({
    context,
    exec,
    interval,
    label,
  }: SchedulerOptions & { interval: number }) {
    let runningInterval: ReturnType<typeof setInterval>;
    lifecycle.onReady(() => {
      runningInterval = setInterval(
        async () =>
          await ZCC.safeExec({
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
    context,
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
      context,
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
              await ZCC.safeExec({
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
}
