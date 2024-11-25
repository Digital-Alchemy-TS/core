import {
  BootstrapOptions,
  CreateApplication,
  InternalDefinition,
  TBlackHole,
  TestRunner,
} from "../src/index.mts";

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
});
