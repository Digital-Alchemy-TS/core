import dayjs from "dayjs";

import { CronExpression, HOUR, MINUTE, SECOND, TestRunner } from "../src/index.mts";

describe("Scheduler", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe("cron", () => {
    it("runs a cron schedule", async () => {
      vi.useFakeTimers();
      const spy = vi.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.cron({
          exec: spy,
          schedule: CronExpression.EVERY_MINUTE,
        });
      });
      vi.advanceTimersByTime(60 * MINUTE);
      expect(spy).toHaveBeenCalledTimes(60);
      vi.useRealTimers();
      await app.teardown();
    });
  });

  describe("interval", () => {
    it("runs an interval schedule", async () => {
      vi.useFakeTimers();
      const spy = vi.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        // @ts-expect-error it's temporarily still here
        scheduler.interval({
          exec: spy,
          interval: MINUTE,
        });
      });
      vi.advanceTimersByTime(60 * MINUTE);
      expect(spy).toHaveBeenCalledTimes(60);
      vi.useRealTimers();
      await app.teardown();
    });
  });

  describe("setInterval", () => {
    it("runs", async () => {
      vi.useFakeTimers();
      const spy = vi.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.setInterval(spy, MINUTE);
      });
      vi.advanceTimersByTime(60 * MINUTE);
      expect(spy).toHaveBeenCalledTimes(60);
      vi.useRealTimers();
      await app.teardown();
    });

    it("stops", async () => {
      vi.useFakeTimers();
      const spy = vi.fn();
      const app = await TestRunner().run(({ scheduler, lifecycle }) => {
        const remove = scheduler.setInterval(spy, MINUTE);
        lifecycle.onReady(() => {
          setTimeout(() => remove(), 30 * MINUTE);
        });
      });
      vi.advanceTimersByTime(60 * MINUTE);
      expect(spy).toHaveBeenCalledTimes(30);
      vi.useRealTimers();
      await app.teardown();
    });

    it("stops early", async () => {
      const spy = vi.fn();
      const intervalSpy = vi.spyOn(globalThis, "setInterval");
      const app = await TestRunner().run(({ scheduler }) => {
        const remove = scheduler.setInterval(spy, MINUTE);
        remove();
      });
      expect(intervalSpy).not.toHaveBeenCalled();
      await app.teardown();
    });
  });

  describe("setTimeout", () => {
    it("runs", async () => {
      vi.useFakeTimers();
      const spy = vi.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.setTimeout(spy, MINUTE);
      });
      vi.advanceTimersByTime(59 * SECOND);
      expect(spy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(3 * SECOND);
      expect(spy).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
      await app.teardown();
    });

    it("stops", async () => {
      vi.useFakeTimers();
      const spy = vi.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        const remove = scheduler.setTimeout(spy, MINUTE);
        setTimeout(() => remove(), 30 * SECOND);
      });
      vi.advanceTimersByTime(5 * MINUTE);
      expect(spy).not.toHaveBeenCalled();
      vi.useRealTimers();
      await app.teardown();
    });

    it("stops early", async () => {
      const spy = vi.fn();
      const intervalSpy = vi.spyOn(globalThis, "setTimeout");
      const app = await TestRunner().run(({ scheduler }) => {
        const remove = scheduler.setTimeout(spy, MINUTE);
        remove();
      });
      expect(intervalSpy).not.toHaveBeenCalled();
      await app.teardown();
    });
  });

  describe("sliding", () => {
    it("requires an next method", async () => {
      expect.assertions(1);

      await TestRunner().run(({ scheduler }) => {
        expect(() => {
          scheduler.sliding({
            exec: () => {},
            next: undefined,
            reset: "",
          });
        }).toThrow();
      });
    });

    it("requires an exec method", async () => {
      expect.assertions(1);

      await TestRunner().run(({ scheduler }) => {
        expect(() => {
          scheduler.sliding({
            exec: undefined,
            next: () => undefined,
            reset: "",
          });
        }).toThrow();
      });
    });

    it("runs a sliding schedule", async () => {
      vi.useFakeTimers();
      const advanceHours = 3;
      vi.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = vi.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.sliding({
          exec: spy,
          next: () => dayjs().add(1, "minute"),
          reset: CronExpression.EVERY_HOUR,
        });
      });
      vi.advanceTimersByTime(advanceHours * HOUR);

      expect(spy).toHaveBeenCalledTimes(advanceHours);
      vi.useRealTimers();
      await app.teardown();
    });

    it("can stop a schedule", async () => {
      vi.useFakeTimers();
      const advanceHours = 3;
      vi.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = vi.fn();
      let stop: () => void;
      const app = await TestRunner().run(({ scheduler }) => {
        stop = scheduler.sliding({
          exec: spy,
          next: () => dayjs().add(1, "minute"),
          reset: CronExpression.EVERY_HOUR,
        });
      });
      stop();
      vi.advanceTimersByTime(advanceHours * HOUR);

      expect(spy).toHaveBeenCalledTimes(0);
      vi.useRealTimers();
      await app.teardown();
    });

    it("can stop a schedule while waiting for next call", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = vi.fn();
      let stop: () => void;
      const app = await TestRunner().run(({ scheduler }) => {
        stop = scheduler.sliding({
          exec: spy,
          next: () => dayjs().add(2, "hour"),
          reset: CronExpression.EVERY_DAY_AT_MIDNIGHT,
        });
      });
      vi.advanceTimersByTime(1 * HOUR);
      stop();
      vi.advanceTimersByTime(2 * HOUR);
      expect(spy).toHaveBeenCalledTimes(0);
      vi.useRealTimers();
      await app.teardown();
    });

    it("does not exec if a next time isn't returned", async () => {
      vi.useFakeTimers();
      const advanceDays = 1;
      vi.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = vi.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.sliding({
          exec: spy,
          next: () => undefined,
          reset: CronExpression.MONDAY_TO_FRIDAY_AT_8AM,
        });
      });
      vi.advanceTimersByTime(advanceDays * HOUR);
      expect(spy).toHaveBeenCalledTimes(0);
      vi.useRealTimers();
      await app.teardown();
    });

    it("does not exec if a next time is in past", async () => {
      vi.useFakeTimers();
      const advanceDays = 1;
      vi.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = vi.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.sliding({
          exec: spy,
          next: () => dayjs().subtract(1, "minute"),
          reset: CronExpression.MONDAY_TO_FRIDAY_AT_8AM,
        });
      });
      vi.advanceTimersByTime(advanceDays * HOUR);
      expect(spy).toHaveBeenCalledTimes(0);
      vi.useRealTimers();
      await app.teardown();
    });
  });
});
