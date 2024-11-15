import { AsyncLocalStorage } from "async_hooks";

import { sleep, TestRunner } from "../src/index.mts";

describe("ALS", () => {
  it("exists", async () => {
    expect.assertions(2);
    await TestRunner().run(({ als }) => {
      expect(als).toBeDefined();

      const storage = als.asyncStorage();
      expect(storage).toBeInstanceOf(AsyncLocalStorage);
    });
  });

  it("enterWith", async () => {
    await TestRunner().run(({ als }) => {
      als.enterWith({
        // @ts-expect-error testing
        test: true,
      });
      const data = als.getStore();
      // @ts-expect-error testing
      expect(data.test).toBe(true);
    });
  });

  it("getLogData", async () => {
    await TestRunner().run(({ als }) => {
      als.enterWith({
        logs: undefined,
      });
      const data = als.getLogData();
      expect(data).toEqual({});
    });
  });

  it("getLogData", async () => {
    await TestRunner().run(({ als }) => {
      als.enterWith({ logs: { test: true } });
      const data = als.getLogData();
      expect(data).toEqual({ test: true });
    });
  });

  it("run", async () => {
    await TestRunner().run(async ({ als }) => {
      const done = vi.fn();
      const data = { logs: {} };
      als.run(data, done);
      await sleep(0);
      expect(done).toHaveBeenCalled();
    });
  });
});
