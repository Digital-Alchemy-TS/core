import {
  ACTIVE_THROTTLE,
  debounce,
  deepExtend,
  each,
  eachLimit,
  eachSeries,
  InternalError,
  sleep,
  TContext,
} from "../src";

describe("utilities", () => {
  describe("sleep", () => {
    it("should delay execution by the specified timeout", async () => {
      const timeout = 100;
      const start = Date.now();

      await sleep(timeout);

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(timeout - 1);
    });

    it('should stop early when kill("continue") is called', async () => {
      const timeout = 200;
      const start = Date.now();

      const timer = sleep(timeout);
      setTimeout(() => timer.kill("continue"), 50);
      await timer;

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(49);
      expect(end - start).toBeLessThan(timeout - 1);
    });

    it('should not resolve if kill("stop") is called before timeout', async () => {
      const timeout = 200;
      const start = Date.now();

      const timer = sleep(timeout);
      setTimeout(() => timer.kill("stop"), 50);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100 milliseconds to ensure the stop has taken effect

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(99);
      expect(end - start).toBeLessThan(timeout - 1);
    });

    it("should handle date object correctly", async () => {
      const targetDate = new Date(Date.now() + 100);
      const start = Date.now();

      await sleep(targetDate);

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(99);
    });
  });

  describe("debounce", () => {
    it("should delay execution by the specified timeout", async () => {
      const identifier = "test-id";
      const timeout = 10;
      const start = Date.now();

      await debounce(identifier, timeout);

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(timeout);
    });

    it("should cancel the previous debounce if called with the same identifier", async () => {
      const identifier = "test-id";
      const timeout1 = 20;
      const timeout2 = 10;

      const start = Date.now();
      debounce(identifier, timeout1);
      await debounce(identifier, timeout2);

      const end = Date.now();
      expect(end - start).toBeLessThan(timeout1);
      expect(end - start).toBeGreaterThanOrEqual(9);
    });

    it("should allow multiple identifiers to be debounced independently", async () => {
      const identifier1 = "test-id-1";
      const identifier2 = "test-id-2";
      const timeout1 = 10;
      const timeout2 = 10;

      const start1 = Date.now();
      debounce(identifier1, timeout1);

      const start2 = Date.now();
      await debounce(identifier2, timeout2);

      const end1 = Date.now();
      expect(end1 - start1).toBeGreaterThanOrEqual(timeout1 - 1);
      expect(end1 - start2).toBeGreaterThanOrEqual(timeout2 - 1);
    });

    it("should clear the debounce once the timeout has passed", async () => {
      const identifier = "test-id";
      const timeout = 100;

      await debounce(identifier, timeout);

      expect(ACTIVE_THROTTLE.has(identifier)).toBe(false);
    });
  });

  describe("eachLimit", () => {
    it("handles an empty array", async () => {
      const items: number[] = [];
      const callback = jest.fn(async () => {});

      await eachLimit(items, 2, callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it("respects the concurrency limit", async () => {
      const repeat = 20;
      const items = [...".".repeat(repeat)].map((_, i) => i);
      const limit = 2;
      const callback = jest.fn(async () => {
        await sleep(100);
      });

      const startTime = Date.now();
      await eachLimit(items, limit, callback);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(callback).toHaveBeenCalledTimes(repeat);
      expect(duration).toBeGreaterThanOrEqual(200); // 5 tasks with a 2-task limit should take ~200ms
    });

    it("handles errors thrown in callback", async () => {
      const items = [1, 2, 3];
      const callback = jest.fn(async (item: number) => {
        if (item === 2) throw new Error("Error on item 2");
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await expect(eachLimit(items, 2, callback)).rejects.toThrow("Error on item 2");
      expect(callback).toHaveBeenCalledTimes(2); // Callback will be called until error is thrown
    });
  });

  describe("each function", () => {
    it("should call the callback for each item in an array", async () => {
      expect.assertions(4);
      const items = [1, 2, 3];
      const mockCallback = jest.fn();

      await each(items, mockCallback);

      expect(mockCallback).toHaveBeenCalledTimes(items.length);
      expect(mockCallback).toHaveBeenCalledWith(1);
      expect(mockCallback).toHaveBeenCalledWith(2);
      expect(mockCallback).toHaveBeenCalledWith(3);
    });

    it("should call the callback for each item in a set", async () => {
      expect.assertions(4);
      const items = new Set([1, 2, 3]);
      const mockCallback = jest.fn();

      await each(items, mockCallback);

      expect(mockCallback).toHaveBeenCalledTimes(items.size);
      expect(mockCallback).toHaveBeenCalledWith(1);
      expect(mockCallback).toHaveBeenCalledWith(2);
      expect(mockCallback).toHaveBeenCalledWith(3);
    });

    it("should handle asynchronous callbacks", async () => {
      expect.assertions(1);
      const items = [1, 2, 3];
      const mockCallback = jest.fn().mockResolvedValue("done");

      await each(items, mockCallback);

      expect(mockCallback).toHaveBeenCalledTimes(items.length);
    });

    it("should handle an empty array without calling the callback", async () => {
      expect.assertions(1);
      const items: number[] = [];
      const mockCallback = jest.fn();

      await each(items, mockCallback);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it("should handle an empty set without calling the callback", async () => {
      expect.assertions(1);
      const items = new Set<number>();
      const mockCallback = jest.fn();

      await each(items, mockCallback);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    describe("eachSeries", () => {
      const mockCallback = jest.fn().mockResolvedValue(undefined);

      beforeEach(() => {
        jest.clearAllMocks();
      });

      it("should call the callback for each item in an array", async () => {
        expect.assertions(4);
        const items = [1, 2, 3];
        await eachSeries(items, mockCallback);

        expect(mockCallback).toHaveBeenCalledTimes(items.length);
        expect(mockCallback).toHaveBeenNthCalledWith(1, 1);
        expect(mockCallback).toHaveBeenNthCalledWith(2, 2);
        expect(mockCallback).toHaveBeenNthCalledWith(3, 3);
      });

      it("should call the callback for each item in a Set", async () => {
        expect.assertions(4);
        const items = new Set([1, 2, 3]);
        await eachSeries(items, mockCallback);

        expect(mockCallback).toHaveBeenCalledTimes(items.size);
        expect(mockCallback).toHaveBeenNthCalledWith(1, 1);
        expect(mockCallback).toHaveBeenNthCalledWith(2, 2);
        expect(mockCallback).toHaveBeenNthCalledWith(3, 3);
      });

      it("should throw a TypeError if the argument is not an array or Set", async () => {
        expect.assertions(2);
        const invalidItem: unknown = {};

        // @ts-expect-error testing
        await expect(eachSeries(invalidItem, mockCallback)).rejects.toThrow(TypeError);
        expect(mockCallback).not.toHaveBeenCalled();
      });

      it("should handle an empty array without calling the callback", async () => {
        expect.assertions(1);
        const items: unknown[] = [];
        await eachSeries(items, mockCallback);

        expect(mockCallback).not.toHaveBeenCalled();
      });
    });
  });

  describe("cloneDeep", () => {
    const data = {
      a: { b: { c: false }, d: [1, 2, 3, 4, { a: 1 }] },
      d: new Date(),
      e: null as unknown,
      r: new RegExp("[a-z]", "g"),
    } as Record<string, unknown>;
    expect(deepExtend({}, data)).toEqual(data);
  });

  it("InternalError", () => {
    const error = new InternalError("" as TContext, "asdf", "qwerty");
    expect(error.name).toBe("InternalError");
  });
  it("InternalError", () => {
    const error = new InternalError("" as TContext, "asdf", "qwerty");
    expect(error.name).toBe("InternalError");
  });
});
