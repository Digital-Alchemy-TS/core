import { CreateApplication, is } from "..";
import { BASIC_BOOT, ServiceTest } from "./testing.helper";

describe("Fetch Extension", () => {
  beforeAll(async () => {
    // @ts-expect-error testing
    const preload = CreateApplication({ name: "testing" });
    await preload.bootstrap(BASIC_BOOT);
    await preload.teardown();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("TitleCase", () => {
    test("converts single word to title case", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        expect(internal.utils.TitleCase("word")).toBe("Word");
      });
    });

    test("converts multiple words separated by spaces to title case", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        expect(internal.utils.TitleCase("multiple words here")).toBe(
          "Multiple Words Here",
        );
      });
    });

    test("converts multiple words separated by underscores to title case", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        expect(internal.utils.TitleCase("multiple_words_here")).toBe(
          "Multiple Words Here",
        );
      });
    });

    test("converts multiple words separated by hyphens to title case", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        expect(internal.utils.TitleCase("multiple-words-here")).toBe(
          "Multiple Words Here",
        );
      });
    });

    test("inserts spaces between camel case words and converts to title case", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        expect(internal.utils.TitleCase("camelCaseWordsHere")).toBe(
          "Camel Case Words Here",
        );
      });
    });

    test("handles empty string input", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        expect(internal.utils.TitleCase("")).toBe("");
      });
    });

    test("handles single character input", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        expect(internal.utils.TitleCase("a")).toBe("A");
      });
    });

    test("handles input with mixed delimiters", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        expect(internal.utils.TitleCase("mixed_delimiters-here now")).toBe(
          "Mixed Delimiters Here Now",
        );
      });
    });
  });

  describe("internal.utils.object.del", () => {
    test("deletes a top-level property", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        const object = { a: 1, b: 2 };
        internal.utils.object.del(object, "a");
        expect(object).toEqual({ b: 2 });
      });
    });

    test("deletes a nested property", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        const object = { a: { b: { c: 3 } } };
        internal.utils.object.del(object, "a.b.c");
        expect(object).toEqual({ a: { b: {} } });
      });
    });

    test("does nothing if the path does not exist", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        const object = { a: { b: { c: 3 } } };
        internal.utils.object.del(object, "a.b.x");
        expect(object).toEqual({ a: { b: { c: 3 } } });
      });
    });

    test("handles path to a non-object gracefully", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        const object = { a: 1 };
        internal.utils.object.del(object, "a.b.c");
        expect(object).toEqual({ a: 1 });
      });
    });

    test("handles deleting from an empty path", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        const object = { a: 1 };
        internal.utils.object.del(object, "");
        expect(object).toEqual({ a: 1 });
      });
    });

    test("handles null or undefined values in the path", async () => {
      expect.assertions(1);
      await ServiceTest(({ internal }) => {
        const object = { a: { b: null } } as object;
        internal.utils.object.del(object, "a.b.c");
        expect(object).toEqual({ a: { b: null } });
      });
    });
  });

  describe("internal.safeExec", () => {
    test("executes the provided function successfully", async () => {
      expect.assertions(1);
      await ServiceTest(async ({ internal }) => {
        const mockFunction = jest.fn();

        await internal.safeExec(mockFunction);

        expect(mockFunction).toHaveBeenCalled();
      });
    });

    test("catches and logs errors thrown by the provided function", async () => {
      expect.assertions(2);
      await ServiceTest(async ({ internal }) => {
        const mockFunction = jest.fn().mockImplementation(() => {
          throw new Error("Test error");
        });
        const mockLogger = jest.spyOn(
          internal.boilerplate.logger.systemLogger,
          "error",
        );

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
