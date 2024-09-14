import { CreateApplication, is } from "../extensions";
import { CreateLibrary } from "../helpers";
import { TestRunner } from "./helpers";

describe("Testing", () => {
  const testingLibrary = CreateLibrary({
    // @ts-expect-error testing
    name: "example",
    services: {
      test: function () {
        return () => true;
      },
    },
  });

  const testingApplication = CreateApplication({
    // @ts-expect-error testing
    name: "example",
    services: {
      test: function () {
        return () => true;
      },
    },
  });

  it("makes assertions against a provided library", async () => {
    expect.assertions(3);

    await TestRunner({ target: testingLibrary }).run((params) => {
      expect("example" in params).toBe(true);
      // @ts-expect-error testing
      expect(is.function(params.example.test)).toBe(true);
      // @ts-expect-error testing
      expect(params.example.test()).toBe(true);
      //
    });
  });

  it("makes assertions against a provided application", async () => {
    expect.assertions(3);

    await TestRunner({ target: testingApplication }).run((params) => {
      expect("example" in params).toBe(true);
      // @ts-expect-error testing
      expect(is.function(params.example.test)).toBe(true);
      // @ts-expect-error testing
      expect(params.example.test()).toBe(true);
      //
    });
  });
});
