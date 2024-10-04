import dayjs from "dayjs";

import { CronExpression, HOUR, MINUTE, SECOND, TestRunner } from "../src";

describe("Scheduler", () => {
  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("cron", () => {
    it("runs a cron schedule", async () => {
      jest.useFakeTimers();
      const spy = jest.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.cron({
          exec: spy,
          schedule: CronExpression.EVERY_MINUTE,
        });
      });
      jest.advanceTimersByTime(60 * MINUTE);
      expect(spy).toHaveBeenCalledTimes(60);
      jest.useRealTimers();
      await app.teardown();
    });
  });

  describe("interval", () => {
    it("runs an interval schedule", async () => {
      jest.useFakeTimers();
      const spy = jest.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        // eslint-disable-next-line sonarjs/deprecation
        scheduler.interval({
          exec: spy,
          interval: MINUTE,
        });
      });
      jest.advanceTimersByTime(60 * MINUTE);
      expect(spy).toHaveBeenCalledTimes(60);
      jest.useRealTimers();
      await app.teardown();
    });
  });

  describe("setInterval", () => {
    it("runs", async () => {
      jest.useFakeTimers();
      const spy = jest.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.setInterval(spy, MINUTE);
      });
      jest.advanceTimersByTime(60 * MINUTE);
      expect(spy).toHaveBeenCalledTimes(60);
      jest.useRealTimers();
      await app.teardown();
    });

    it("stops", async () => {
      jest.useFakeTimers();
      const spy = jest.fn();
      const app = await TestRunner().run(({ scheduler, lifecycle }) => {
        const remove = scheduler.setInterval(spy, MINUTE);
        lifecycle.onReady(() => {
          setTimeout(() => remove(), 30 * MINUTE);
        });
      });
      jest.advanceTimersByTime(60 * MINUTE);
      expect(spy).toHaveBeenCalledTimes(30);
      jest.useRealTimers();
      await app.teardown();
    });

    it("stops early", async () => {
      const spy = jest.fn();
      const intervalSpy = jest.spyOn(global, "setInterval");
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
      jest.useFakeTimers();
      const spy = jest.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.setTimeout(spy, MINUTE);
      });
      jest.advanceTimersByTime(59 * SECOND);
      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(3 * SECOND);
      expect(spy).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
      await app.teardown();
    });

    it("stops", async () => {
      jest.useFakeTimers();
      const spy = jest.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        const remove = scheduler.setTimeout(spy, MINUTE);
        setTimeout(() => remove(), 30 * SECOND);
      });
      jest.advanceTimersByTime(5 * MINUTE);
      expect(spy).not.toHaveBeenCalled();
      jest.useRealTimers();
      await app.teardown();
    });

    it("stops early", async () => {
      const spy = jest.fn();
      const intervalSpy = jest.spyOn(global, "setTimeout");
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
      jest.useFakeTimers();
      const advanceHours = 3;
      jest.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = jest.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.sliding({
          exec: spy,
          next: () => dayjs().add(1, "minute"),
          reset: CronExpression.EVERY_HOUR,
        });
      });
      jest.advanceTimersByTime(advanceHours * HOUR);

      expect(spy).toHaveBeenCalledTimes(advanceHours);
      jest.useRealTimers();
      await app.teardown();
    });

    it("can stop a schedule", async () => {
      jest.useFakeTimers();
      const advanceHours = 3;
      jest.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = jest.fn();
      let stop: () => void;
      const app = await TestRunner().run(({ scheduler }) => {
        stop = scheduler.sliding({
          exec: spy,
          next: () => dayjs().add(1, "minute"),
          reset: CronExpression.EVERY_HOUR,
        });
      });
      stop();
      jest.advanceTimersByTime(advanceHours * HOUR);

      expect(spy).toHaveBeenCalledTimes(0);
      jest.useRealTimers();
      await app.teardown();
    });

    it("can stop a schedule while waiting for next call", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = jest.fn();
      let stop: () => void;
      const app = await TestRunner().run(({ scheduler }) => {
        stop = scheduler.sliding({
          exec: spy,
          next: () => dayjs().add(2, "hour"),
          reset: CronExpression.EVERY_DAY_AT_MIDNIGHT,
        });
      });
      jest.advanceTimersByTime(1 * HOUR);
      stop();
      jest.advanceTimersByTime(2 * HOUR);
      expect(spy).toHaveBeenCalledTimes(0);
      jest.useRealTimers();
      await app.teardown();
    });

    it("does not exec if a next time isn't returned", async () => {
      jest.useFakeTimers();
      const advanceDays = 1;
      jest.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = jest.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.sliding({
          exec: spy,
          next: () => undefined,
          reset: CronExpression.MONDAY_TO_FRIDAY_AT_8AM,
        });
      });
      jest.advanceTimersByTime(advanceDays * HOUR);
      expect(spy).toHaveBeenCalledTimes(0);
      jest.useRealTimers();
      await app.teardown();
    });

    it("does not exec if a next time is in past", async () => {
      jest.useFakeTimers();
      const advanceDays = 1;
      jest.setSystemTime(dayjs("2024-09-13T00:00:00.000Z").toDate());
      const spy = jest.fn();
      const app = await TestRunner().run(({ scheduler }) => {
        scheduler.sliding({
          exec: spy,
          next: () => dayjs().subtract(1, "minute"),
          reset: CronExpression.MONDAY_TO_FRIDAY_AT_8AM,
        });
      });
      jest.advanceTimersByTime(advanceDays * HOUR);
      expect(spy).toHaveBeenCalledTimes(0);
      jest.useRealTimers();
      await app.teardown();
    });
  });
});
