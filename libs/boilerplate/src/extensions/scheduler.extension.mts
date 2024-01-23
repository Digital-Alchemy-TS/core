/* eslint-disable sonarjs/cognitive-complexity */
import { is } from "@zcc/utilities";
import { CronJob } from "cron";
import { nextTick } from "mqtt";

import { InternalError } from "../helpers/errors.helper.mjs";
import {
  ACTIVE_SCHEDULES,
  SCHEDULE_ERRORS,
  SCHEDULE_EXECUTION_COUNT,
  SCHEDULE_EXECUTION_TIME,
} from "../helpers/metrics.helper.mjs";
import {
  ScheduleItem,
  SchedulerOptions,
  TScheduler,
  TServiceParams,
} from "../helpers/wiring.helper.mjs";

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

    async function SafeExec() {
      try {
        // no label, no metrics
        if (is.empty(label)) {
          await exec();
          return;
        }
        SCHEDULE_EXECUTION_COUNT.labels(context, label).inc();
        const end = SCHEDULE_EXECUTION_TIME.startTimer();
        await exec();
        end({ context, label });
      } catch (error) {
        logger.error({ context, error, label }, `Cron callback threw error`);
        if (!is.empty(label)) {
          SCHEDULE_ERRORS.labels(context, label).inc();
        }
      }
    }

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
          const schedule = options.schedule;
          logger.debug({ context, label, schedule }, `Starting schedule`);
          const cronJob = new CronJob(schedule, async () => await SafeExec());
          cronJob.start();
          ACTIVE_SCHEDULES.labels("cron").inc();
          stop = () => {
            ACTIVE_SCHEDULES.labels("cron").dec();
          };
          return;
        }
        // intervals
        if ("interval" in options) {
          const interval = setInterval(
            async () => await SafeExec(),
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
