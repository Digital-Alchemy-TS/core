import { v4 } from "uuid";

import { CreateApplication, CreateLibrary, createModule, is, TestRunner } from "../src/index.mts";

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

  const appendLibrary = CreateLibrary({
    // @ts-expect-error testing
    name: "append",
    services: {
      test: function () {
        return () => true;
      },
    },
  });

  const overrideLibrary = CreateLibrary({
    // @ts-expect-error testing
    name: "example",
    priorityInit: ["test"],
    services: {
      test: function () {
        return () => false;
      },
    },
  });

  const overrideLibraryAgain = CreateLibrary({
    // @ts-expect-error testing
    name: "example",
    services: {
      test: function () {
        return () => "wat";
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

  const wrapperLibrary = CreateLibrary({
    depends: [testingLibrary],
    // @ts-expect-error testing
    name: "another_example",
    services: {
      test: function () {
        return () => true;
      },
    },
  });

  const topApplication = CreateApplication({
    libraries: [wrapperLibrary, testingLibrary],
    // @ts-expect-error testing
    name: "example",
    services: {
      test: function () {
        return () => true;
      },
    },
  });

  // #MARK: Basics
  describe("Basics", () => {
    it("makes assertions against a provided library", async () => {
      expect.assertions(3);

      await TestRunner({ target: testingLibrary }).run(params => {
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

      await TestRunner({ target: testingApplication }).run(params => {
        expect("example" in params).toBe(true);
        // @ts-expect-error testing
        expect(is.function(params.example.test)).toBe(true);
        // @ts-expect-error testing
        expect(params.example.test()).toBe(true);
      });
    });
  });

  // #MARK: reformat
  describe("reformat", () => {
    it("can build a generic module from libraries", async () => {
      expect.assertions(11);
      const generic = createModule.fromLibrary(testingLibrary);
      expect(generic).toBeDefined();
      const rebuild = generic.extend();
      expect(rebuild.appendLibrary).toBeDefined();
      expect(rebuild.appendService).toBeDefined();
      expect(rebuild.replaceLibrary).toBeDefined();
      expect(rebuild.replaceService).toBeDefined();
      expect(rebuild.pickService).toBeDefined();
      expect(rebuild.omitService).toBeDefined();
      expect(rebuild.rebuild).toBeDefined();
      expect(rebuild.toApplication).toBeDefined();
      expect(rebuild.toLibrary).toBeDefined();
      expect(rebuild.toTest).toBeDefined();
    });

    it("builds a test from generic", async () => {
      expect.assertions(1);
      const test = createModule.fromLibrary(testingLibrary).extend().toTest();
      expect(test.type).toBe("test");
    });
  });

  // #MARK: appendLibrary
  describe("appendLibrary", () => {
    it("can append libraries", async () => {
      expect.assertions(1);
      const test = createModule
        .fromApplication(topApplication)
        .extend()
        .appendLibrary(appendLibrary)
        .toTest();
      // @ts-expect-error testing
      await test.run(({ append }) => {
        expect(append.test).toBeDefined();
      });
      await test.teardown();
    });

    it("cannot append something with an in use name (already appended)", async () => {
      expect.assertions(1);
      const test = createModule
        .fromApplication(topApplication)
        .extend()
        .appendLibrary(appendLibrary);
      expect(() => {
        test.appendLibrary(appendLibrary);
      }).toThrow();
    });

    it("cannot append something with an in use name (existing)", async () => {
      expect.assertions(1);
      const test = createModule.fromApplication(topApplication).extend();
      expect(() => {
        test.appendLibrary(overrideLibrary);
      }).toThrow();
    });
  });

  // #MARK: appendService
  describe("appendService", () => {
    it("cannot append an existing service", () => {
      expect.assertions(1);
      const test = createModule.fromApplication(topApplication).extend();
      expect(() => {
        test.appendService("test", vi.fn());
      }).toThrow();
    });

    it("can append a service with a unique name", async () => {
      expect.assertions(1);
      const spy = vi.fn();
      const id = v4();
      const test = createModule.fromApplication(topApplication).extend().appendService(id, spy);
      const runner = test.toLibrary();
      expect(runner.services[id]).toBe(spy);
    });
  });

  // #MARK: quick
  describe("quick replacements", () => {
    it("omitService", () => {
      expect.assertions(1);
      const out = createModule
        .fromApplication(topApplication)
        .extend()
        .omitService("test")
        .toLibrary();
      expect(Object.keys(out.services)).toEqual([]);
    });

    it("pickService", () => {
      expect.assertions(1);
      const id = v4();
      const out = createModule
        .fromApplication(topApplication)
        .extend()
        .appendService(id, vi.fn())
        .pickService(id)
        .toLibrary();
      expect(Object.keys(out.services)).toEqual([id]);
    });

    it("rebuild", () => {
      expect.assertions(1);
      const spy = vi.fn();
      const out = createModule
        .fromApplication(topApplication)
        .extend()
        .rebuild({ test: spy })
        .toLibrary();
      expect(out.services.test).toEqual(spy);
    });
  });

  // #MARK: replaceLibrary
  describe("replaceLibrary", () => {
    it("can replace libraries", async () => {
      expect.assertions(1);
      const test = createModule
        .fromApplication(topApplication)
        .extend()
        .replaceLibrary(overrideLibrary)
        .toTest();
      // @ts-expect-error testing
      await test.run(({ example }) => {
        const result = example.test();
        expect(result).toBe(false);
      });
      await test.teardown();
    });

    it("can replace override replaces", async () => {
      expect.assertions(1);
      const test = createModule
        .fromApplication(topApplication)
        .extend()
        .replaceLibrary(overrideLibrary)
        .replaceLibrary(overrideLibraryAgain)
        .toTest();
      // @ts-expect-error testing
      await test.run(({ example }) => {
        const result = example.test();
        expect(result).toBe("wat");
      });
      await test.teardown();
    });

    it("cannot replace libraries that don't exist", async () => {
      expect.assertions(1);
      const test = createModule.fromApplication(topApplication).extend();
      expect(() => {
        test.replaceLibrary(appendLibrary);
      }).toThrow();
    });
  });

  // #MARK: replaceService
  describe("replaceService", () => {
    it("can replace libraries", async () => {
      expect.assertions(1);
      const spy = vi.fn();
      const test = createModule.fromApplication(topApplication).extend();
      expect(() => {
        test.replaceService(v4(), spy);
      }).toThrow();
    });

    it("can replace services", async () => {
      expect.assertions(1);
      const spy = vi.fn();
      const test = createModule
        .fromApplication(topApplication)
        .extend()
        .replaceService("test", spy)
        .toLibrary();
      expect(test.services.test).toBe(spy);
    });
  });

  // #MARK: Outputs
  describe("Outputs", () => {
    describe("Applications", () => {
      it("can create", () => {
        expect.assertions(1);
        const test = createModule.fromLibrary(testingLibrary).extend().toApplication();
        expect(test.type).toBe("application");
      });

      it("preserves priorityInit", async () => {
        expect.assertions(1);
        const test = createModule.fromLibrary(overrideLibrary).extend().toLibrary();
        expect(test.priorityInit).toEqual(["test"]);
      });
    });
    it("can return params instead of running", async () => {
      const params = await TestRunner().serviceParams();
      expect(params.lifecycle).toBeDefined();
      expect(params.logger).toBeDefined();
      expect(params.context).toBeDefined();
      expect(params.config).toBeDefined();
    });

    describe("optionalDepends", () => {
      it("defaults optionalDepends for apps", () => {
        expect.assertions(2);
        const test = createModule({
          configuration: {},
          depends: [],
          name: "test",
          priorityInit: [],
          services: undefined,
        });
        expect(test.optionalDepends).toEqual([]);
        expect(test.services).toEqual({});
      });

      it("preserves optionalDepends for libraries", () => {
        expect.assertions(1);
        const test = createModule.fromLibrary(
          CreateLibrary({
            // @ts-expect-error testing
            name: "asdf",
            optionalDepends: [testingLibrary],
            services: {},
          }),
        );
        expect(test.optionalDepends).toEqual([testingLibrary]);
      });
    });
  });
});
