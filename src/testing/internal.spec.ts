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
});
