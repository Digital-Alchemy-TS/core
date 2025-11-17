import type { BootstrapOptions, TBlackHole } from "../src/index.mts";
import { CreateApplication, InternalDefinition, TestRunner } from "../src/index.mts";

export const BASIC_BOOT = {
  configuration: { boilerplate: { LOG_LEVEL: "silent" } },
  loggerOptions: {
    levelOverrides: {
      boilerplate: "warn",
    },
  },
} as BootstrapOptions;

describe("Fetch Extension", () => {
  beforeAll(async () => {
    vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis.console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
    vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
    const preload = CreateApplication({
      // @ts-expect-error testing
      name: "testing",
    });
    await preload.bootstrap(BASIC_BOOT);
    await preload.teardown();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe("removeFn", () => {
    const internal = new InternalDefinition();

    it("should return a function with a remove property", () => {
      const mockRemove: () => TBlackHole = vi.fn(() => ({}) as TBlackHole);
      const result = internal.removeFn(mockRemove);

      expect(typeof result).toBe("function");
      expect(result.remove).toBe(mockRemove);
    });

    it("should correctly call the remove function", () => {
      const mockRemove: () => TBlackHole = vi.fn(() => ({}) as TBlackHole);
      const result = internal.removeFn(mockRemove);

      result(); // Call the function
      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it("should allow calling remove via the returned function", () => {
      const mockRemove: () => TBlackHole = vi.fn(() => ({}) as TBlackHole);
      const result = internal.removeFn(mockRemove);

      result.remove!(); // Call remove
      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it("should support both destructured and non-destructured usage", () => {
      const mockRemove: () => TBlackHole = vi.fn(() => ({}) as TBlackHole);
      // Destructured case
      const { remove } = internal.removeFn(mockRemove);
      remove!(); // Call remove
      expect(mockRemove).toHaveBeenCalledTimes(1);

      // Non-destructured case
      const result = internal.removeFn(mockRemove);
      result(); // Call the function
      expect(mockRemove).toHaveBeenCalledTimes(2); // Called once more
    });
  });

  describe("relativeDate", () => {
    describe("relativeDate", () => {
      it("should return the correct relative time for a valid past date", async () => {
        await TestRunner().run(({ internal }) => {
          const pastDate = "2023-09-01T00:00:00.000Z";
          const futureDate = "2024-09-01T00:00:00.000Z";
          const result = internal.utils.relativeDate(pastDate, futureDate);
          expect(result).toBe("last yr.");
        });
      });

      it("should default to current date when futureDate is not provided", async () => {
        await TestRunner().run(({ internal }) => {
          const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const result = internal.utils.relativeDate(pastDate);
          expect(result).toBe("24 hr. ago");
        });
      });

      it("should throw an error for an invalid past date", async () => {
        await TestRunner().run(({ internal }) => {
          const invalidPastDate = "invalid-date";
          expect(() => internal.utils.relativeDate(invalidPastDate)).toThrow(
            "invalid past date invalid-date",
          );
        });
      });

      it("should throw an error for an invalid future date", async () => {
        await TestRunner().run(({ internal }) => {
          const pastDate = "2023-09-01T00:00:00.000Z";
          const invalidFutureDate = "invalid-date";
          expect(() => internal.utils.relativeDate(pastDate, invalidFutureDate)).toThrow(
            "invalid future date 2023-09-01T00:00:00.000Z",
          );
        });
      });
    });
  });

  describe("titleCase", () => {
    it("converts single word to title case", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.utils.titleCase("word")).toBe("Word");
      });
    });

    it("converts multiple words separated by spaces to title case", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.utils.titleCase("multiple words here")).toBe("Multiple Words Here");
      });
    });

    it("converts multiple words separated by underscores to title case", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.utils.titleCase("multiple_words_here")).toBe("Multiple Words Here");
      });
    });

    it("converts multiple words separated by hyphens to title case", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.utils.titleCase("multiple-words-here")).toBe("Multiple Words Here");
      });
    });

    it("inserts spaces between camel case words and converts to title case", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.utils.titleCase("camelCaseWordsHere")).toBe("Camel Case Words Here");
      });
    });

    it("handles empty string input", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.utils.titleCase("")).toBe("");
      });
    });

    it("handles single character input", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.utils.titleCase("a")).toBe("A");
      });
    });

    it("handles input with mixed delimiters", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.utils.titleCase("mixed_delimiters-here now")).toBe(
          "Mixed Delimiters Here Now",
        );
      });
    });
  });

  describe("internal.utils.object.set", () => {
    it("throws for setting non-objects", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(() => {
          internal.utils.object.set(null, "a", "b");
        }).toThrow();
      });
    });

    it("respects doNotReplace", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const data = { a: { b: { c: false } } };
        internal.utils.object.set(data, "a", false, true);
        expect(typeof data.a.b).toBe("object");
      });
    });
  });

  describe("internal.utils.object.del", () => {
    it("deletes a top-level property", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: 1, b: 2 };
        internal.utils.object.del(object, "a");
        expect(object).toEqual({ b: 2 });
      });
    });

    it("deletes a nested property", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: { b: { c: 3 } } };
        internal.utils.object.del(object, "a.b.c");
        expect(object).toEqual({ a: { b: {} } });
      });
    });

    it("does nothing if the path does not exist", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: { b: { c: 3 } } };
        internal.utils.object.del(object, "a.b.x");
        expect(object).toEqual({ a: { b: { c: 3 } } });
      });
    });

    it("handles path to a non-object gracefully", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: 1 };
        internal.utils.object.del(object, "a.b.c");
        expect(object).toEqual({ a: 1 });
      });
    });

    it("handles deleting from an empty path", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: 1 };
        internal.utils.object.del(object, "");
        expect(object).toEqual({ a: 1 });
      });
    });

    it("handles null or undefined values in the path", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: { b: null } } as object;
        internal.utils.object.del(object, "a.b.c");
        expect(object).toEqual({ a: { b: null } });
      });
    });

    it("handles null or undefined values in the path", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(() => {
          internal.utils.object.del(null, "a.b.c");
        }).not.toThrow();
      });
    });
  });

  describe("internal.safeExec", () => {
    it("executes the provided function successfully", async () => {
      expect.assertions(1);
      await TestRunner().run(async ({ internal }) => {
        const mockFunction = vi.fn();
        await internal.safeExec(mockFunction);
        expect(mockFunction).toHaveBeenCalled();
      });
    });

    it("executes the provided function successfully", async () => {
      expect.assertions(1);
      await TestRunner().run(async ({ internal }) => {
        expect(await internal.safeExec(undefined)).toBeUndefined();
      });
    });

    it("catches and logs errors thrown by the provided function", async () => {
      expect.assertions(2);
      await TestRunner().run(async ({ internal }) => {
        const mockFunction = vi.fn().mockImplementation(() => {
          throw new Error("Test error");
        });
        const mockLogger = vi.spyOn(internal.boilerplate.logger.systemLogger, "error");

        await internal.safeExec(mockFunction);

        expect(mockFunction).toHaveBeenCalled();
        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({ error: expect.any(Error) }),
          "callback threw error",
        );

        mockLogger.mockRestore();
      });
    });
  });

  describe("internal.utils.getIntervalTarget", () => {
    it("handles number offset (milliseconds)", async () => {
      expect.assertions(2);
      await TestRunner().run(({ internal }) => {
        const offset = 5000; // 5 seconds
        const result = internal.utils.getIntervalTarget(offset);
        const now = Date.now();
        const resultTime = result.valueOf();
        // Should be approximately 5 seconds in the future (allow 100ms tolerance)
        expect(resultTime).toBeGreaterThanOrEqual(now + offset - 100);
        expect(resultTime).toBeLessThanOrEqual(now + offset + 100);
      });
    });

    it("handles array/tuple offset [amount, unit]", async () => {
      expect.assertions(2);
      await TestRunner().run(({ internal }) => {
        const result = internal.utils.getIntervalTarget([2, "hours"]);
        const now = Date.now();
        const resultTime = result.valueOf();
        const expectedMs = 2 * 60 * 60 * 1000; // 2 hours in ms
        expect(resultTime).toBeGreaterThanOrEqual(now + expectedMs - 100);
        expect(resultTime).toBeLessThanOrEqual(now + expectedMs + 100);
      });
    });

    it("handles object offset (DurationUnitsObjectType)", async () => {
      expect.assertions(2);
      await TestRunner().run(({ internal }) => {
        const offset = { minutes: 30, seconds: 15 };
        const result = internal.utils.getIntervalTarget(offset);
        const now = Date.now();
        const resultTime = result.valueOf();
        const expectedMs = 30 * 60 * 1000 + 15 * 1000; // 30 minutes + 15 seconds
        expect(resultTime).toBeGreaterThanOrEqual(now + expectedMs - 100);
        expect(resultTime).toBeLessThanOrEqual(now + expectedMs + 100);
      });
    });

    it("handles string offset (ISO 8601 partial)", async () => {
      expect.assertions(2);
      await TestRunner().run(({ internal }) => {
        const offset = "1H30M"; // 1 hour 30 minutes
        const result = internal.utils.getIntervalTarget(offset);
        const now = Date.now();
        const resultTime = result.valueOf();
        const expectedMs = 1 * 60 * 60 * 1000 + 30 * 60 * 1000; // 1 hour + 30 minutes
        expect(resultTime).toBeGreaterThanOrEqual(now + expectedMs - 100);
        expect(resultTime).toBeLessThanOrEqual(now + expectedMs + 100);
      });
    });

    it("handles function offset", async () => {
      expect.assertions(2);
      await TestRunner().run(({ internal }) => {
        const offset = () => 10000; // 10 seconds
        const result = internal.utils.getIntervalTarget(offset);
        const now = Date.now();
        const resultTime = result.valueOf();
        expect(resultTime).toBeGreaterThanOrEqual(now + 10000 - 100);
        expect(resultTime).toBeLessThanOrEqual(now + 10000 + 100);
      });
    });

    it("handles Duration object", async () => {
      expect.assertions(2);
      await TestRunner().run(async ({ internal }) => {
        const dayjs = (await import("dayjs")).default;
        const duration = dayjs.duration({ hours: 1 });
        const result = internal.utils.getIntervalTarget(duration);
        const now = Date.now();
        const resultTime = result.valueOf();
        const expectedMs = 60 * 60 * 1000; // 1 hour
        expect(resultTime).toBeGreaterThanOrEqual(now + expectedMs - 100);
        expect(resultTime).toBeLessThanOrEqual(now + expectedMs + 100);
      });
    });

    it("returns current time when offset is invalid", async () => {
      expect.assertions(2);
      await TestRunner().run(({ internal }) => {
        const result = internal.utils.getIntervalTarget(null);
        const now = Date.now();
        const resultTime = result.valueOf();
        // Should be approximately now (allow 100ms tolerance)
        expect(resultTime).toBeGreaterThanOrEqual(now - 100);
        expect(resultTime).toBeLessThanOrEqual(now + 100);
      });
    });
  });

  describe("internal.utils.getIntervalMs", () => {
    it("handles number offset (milliseconds)", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const offset = 5000;
        const result = internal.utils.getIntervalMs(offset);
        expect(result).toBe(5000);
      });
    });

    it("handles array/tuple offset [amount, unit]", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const result = internal.utils.getIntervalMs([2, "hours"]);
        const expectedMs = 2 * 60 * 60 * 1000; // 2 hours in ms
        expect(result).toBe(expectedMs);
      });
    });

    it("handles object offset (DurationUnitsObjectType)", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const offset = { minutes: 30, seconds: 15 };
        const result = internal.utils.getIntervalMs(offset);
        const expectedMs = 30 * 60 * 1000 + 15 * 1000; // 30 minutes + 15 seconds
        expect(result).toBe(expectedMs);
      });
    });

    it("handles string offset (ISO 8601 partial)", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const offset = "1H30M"; // 1 hour 30 minutes
        const result = internal.utils.getIntervalMs(offset);
        const expectedMs = 1 * 60 * 60 * 1000 + 30 * 60 * 1000; // 1 hour + 30 minutes
        expect(result).toBe(expectedMs);
      });
    });

    it("handles function offset", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const offset = () => 10000; // 10 seconds
        const result = internal.utils.getIntervalMs(offset);
        expect(result).toBe(10000);
      });
    });

    it("handles Duration object", async () => {
      expect.assertions(1);
      await TestRunner().run(async ({ internal }) => {
        const dayjs = (await import("dayjs")).default;
        const duration = dayjs.duration({ hours: 1 });
        const result = internal.utils.getIntervalMs(duration);
        const expectedMs = 60 * 60 * 1000; // 1 hour
        expect(result).toBe(expectedMs);
      });
    });

    it("returns 0 when offset is invalid", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const result = internal.utils.getIntervalMs(null);
        expect(result).toBe(0);
      });
    });
  });

  describe("internal.utils.object.get", () => {
    it("gets a top-level property", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: 1, b: 2 };
        const result = internal.utils.object.get(object, "a");
        expect(result).toBe(1);
      });
    });

    it("gets a nested property", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: { b: { c: 3 } } };
        const result = internal.utils.object.get(object, "a.b.c");
        expect(result).toBe(3);
      });
    });

    it("returns undefined for non-existent top-level property", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: 1, b: 2 };
        const result = internal.utils.object.get(object, "x");
        expect(result).toBeUndefined();
      });
    });

    it("returns undefined for non-existent nested property", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: { b: { c: 3 } } };
        const result = internal.utils.object.get(object, "a.b.x");
        expect(result).toBeUndefined();
      });
    });

    it("returns undefined when path goes through a non-object", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: 1 };
        const result = internal.utils.object.get(object, "a.b.c");
        expect(result).toBeUndefined();
      });
    });

    it("returns undefined when path goes through null", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const object = { a: { b: null } } as object;
        const result = internal.utils.object.get(object, "a.b.c");
        expect(result).toBeUndefined();
      });
    });

    it("handles empty path", async () => {
      expect.assertions(1);
      await TestRunner().run(async ({ internal }) => {
        const object = { a: 1 };
        const result = internal.utils.object.get(object, "");
        expect(result).toBe(undefined);
      });
    });

    it("gets a property with falsy value", async () => {
      expect.assertions(4);
      await TestRunner().run(({ internal }) => {
        // @ts-expect-error part of testing
        const object = { a: false, b: 0, c: "", d: null };
        expect(internal.utils.object.get(object, "a")).toBe(false);
        expect(internal.utils.object.get(object, "b")).toBe(0);
        expect(internal.utils.object.get(object, "c")).toBe("");
        expect(internal.utils.object.get(object, "d")).toBeNull();
      });
    });

    it("gets nested property with falsy value", async () => {
      expect.assertions(2);
      await TestRunner().run(({ internal }) => {
        const object = { a: { b: false, c: 0 } };
        expect(internal.utils.object.get(object, "a.b")).toBe(false);
        expect(internal.utils.object.get(object, "a.c")).toBe(0);
      });
    });
  });
});
