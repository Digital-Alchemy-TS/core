import dayjs from "dayjs";

import { CronExpression, HOUR, MINUTE, TestRunner } from "../src";

describe("Scheduler", () => {
  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("runs a cron schedule", async () => {
    jest.useFakeTimers();
    const spy = jest.fn();
    const app = await TestRunner().run(({ scheduler }) => {
      scheduler.cron({
        exec: spy,
        schedule: CronExpression.EVERY_MINUTE,
      });
    });
    jest.advanceTimersByTime(60 * 60 * 1000);
    expect(spy).toHaveBeenCalledTimes(60);
    jest.useRealTimers();
    await app.teardown();
  });

  it("runs an interval schedule", async () => {
    jest.useFakeTimers();
    const spy = jest.fn();
    const app = await TestRunner().run(({ scheduler }) => {
      scheduler.interval({
        exec: spy,
        interval: MINUTE,
      });
    });
    jest.advanceTimersByTime(60 * 60 * 1000);
    expect(spy).toHaveBeenCalledTimes(60);
    jest.useRealTimers();
    await app.teardown();
  });

  xit("runs an interval schedule", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(dayjs("2024-09-13T05:00:00.000Z").toDate());
    const spy = jest.fn();
    const app = await TestRunner().run(({ scheduler }) => {
      scheduler.sliding({
        exec: () => spy,
        next: () => dayjs().add(1, "minute"),
        reset: CronExpression.MONDAY_TO_FRIDAY_AT_8AM,
      });
    });
    jest.advanceTimersByTime(4 * HOUR);
    expect(spy).toHaveBeenCalledTimes(60);
    jest.useRealTimers();
    await app.teardown();
  });
});
