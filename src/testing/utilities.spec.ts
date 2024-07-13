import { ACTIVE_THROTTLE, sleep, throttle } from "../helpers";

describe("utilities", () => {
  describe("sleep", () => {
    it("should delay execution by the specified timeout", async () => {
      const timeout = 100;
      const start = Date.now();

      await sleep(timeout);

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(timeout);
    });

    it('should stop early when kill("continue") is called', async () => {
      const timeout = 200;
      const start = Date.now();

      const timer = sleep(timeout);
      setTimeout(() => timer.kill("continue"), 50);
      await timer;

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(50);
      expect(end - start).toBeLessThan(timeout);
    });

    it('should not resolve if kill("stop") is called before timeout', async () => {
      const timeout = 200;
      const start = Date.now();

      const timer = sleep(timeout);
      setTimeout(() => timer.kill("stop"), 50);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 100 milliseconds to ensure the stop has taken effect

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(100);
      expect(end - start).toBeLessThan(timeout);
    });

    it("should handle date object correctly", async () => {
      const targetDate = new Date(Date.now() + 100);
      const start = Date.now();

      await sleep(targetDate);

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(100);
    });
  });

  describe("throttle", () => {
    it("should delay execution by the specified timeout", async () => {
      const identifier = "test-id";
      const timeout = 10;
      const start = Date.now();

      await throttle(identifier, timeout);

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(timeout);
    });

    it("should cancel the previous throttle if called with the same identifier", async () => {
      const identifier = "test-id";
      const timeout1 = 20;
      const timeout2 = 10;

      const start = Date.now();
      throttle(identifier, timeout1);
      await throttle(identifier, timeout2);

      const end = Date.now();
      expect(end - start).toBeLessThan(timeout1);
      expect(end - start).toBeGreaterThanOrEqual(timeout2);
    });

    it("should allow multiple identifiers to be throttled independently", async () => {
      const identifier1 = "test-id-1";
      const identifier2 = "test-id-2";
      const timeout1 = 10;
      const timeout2 = 10;

      const start1 = Date.now();
      throttle(identifier1, timeout1);

      const start2 = Date.now();
      await throttle(identifier2, timeout2);

      const end1 = Date.now();
      expect(end1 - start1).toBeGreaterThanOrEqual(timeout1);
      expect(end1 - start2).toBeGreaterThanOrEqual(timeout2);
    });

    it("should clear the throttle once the timeout has passed", async () => {
      const identifier = "test-id";
      const timeout = 100;

      await throttle(identifier, timeout);

      expect(ACTIVE_THROTTLE.has(identifier)).toBe(false);
    });
  });
});
