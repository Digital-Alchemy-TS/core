/* eslint-disable sonarjs/cognitive-complexity */
import { is, ZCC } from "@zcc/utilities";
import { CronJob } from "cron";
import { nextTick } from "mqtt";

import {
  ACTIVE_SCHEDULES,
  InternalError,
  SCHEDULE_ERRORS,
  SCHEDULE_EXECUTION_COUNT,
  SCHEDULE_EXECUTION_TIME,
  ScheduleItem,
  SchedulerOptions,
  TScheduler,
  TServiceParams,
} from "../helpers/index.mjs";

export function ZCC_Scheduler({
  logger,
  lifecycle,
  context: parentContext,
}: TServiceParams): TScheduler {
  let started = false;
  const schedules = new Set<ScheduleItem>();

  lifecycle.onReady(() => {
    started = true;
    schedules.forEach(i => i.start());
  });

  lifecycle.onShutdownStart(() => {
    started = false;
    schedules.forEach(i => {
      i.stop();
      schedules.delete(i);
    });
  });

  return function ({
    context,
    exec,
    label,
    ...options
  }: SchedulerOptions): ScheduleItem {
    logger.trace({ context, label }, `Creating new schedule`);

    let stop: () => void;
    const safeExec = async () =>
      await ZCC.safeExec({
        duration: SCHEDULE_EXECUTION_TIME,
        errors: SCHEDULE_ERRORS,
        exec,
        executions: SCHEDULE_EXECUTION_COUNT,
        labels: { context, label },
      });

    const item: ScheduleItem = {
      start: () => {
        if (stop) {
          throw new InternalError(
            context,
            "DOUBLE_SCHEDULE_START",
            "Attempted to start a schedule that was already started, this can lead to leaks",
          );
        }

        // node-cron
        if ("schedule" in options) {
          // I enjoy .flat() too much
          [options.schedule].flat().forEach(schedule => {
            logger.debug({ context, label, schedule }, `Starting schedule`);
            const cronJob = new CronJob(schedule, async () => await safeExec());
            cronJob.start();
            ACTIVE_SCHEDULES.labels("cron").inc();
            stop = () => {
              ACTIVE_SCHEDULES.labels("cron").dec();
            };
          });
          return;
        }

        // intervals
        if ("interval" in options) {
          const interval = setInterval(
            async () => await safeExec(),
            options.interval,
          );
          ACTIVE_SCHEDULES.labels("interval").inc();
          stop = () => {
            clearInterval(interval);
            ACTIVE_SCHEDULES.labels("interval").dec();
          };
          return;
        }

        // wat
        throw new InternalError(
          parentContext,
          "INVALID_SCHEDULE",
          "Not able to determine schedule type",
        );
      },
      stop: () => {
        if (stop) {
          stop();
          stop = undefined;
          return;
        }
        logger.warn({ context, label }, `Nothing to stop`);
      },
    };

    schedules.add(item);
    if (started) {
      logger.trace({ context, label }, `Auto starting`);
      nextTick(() => item.start());
    }
    return item;
  };
}
