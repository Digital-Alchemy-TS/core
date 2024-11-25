import {
  ApplicationDefinition,
  BootstrapException,
  BootstrapOptions,
  buildSortOrder,
  CreateApplication,
  CreateLibrary,
  createMockLogger,
  createModule,
  InternalDefinition,
  LifecycleStages,
  OptionalModuleConfiguration,
  ServiceMap,
  sleep,
  TestRunner,
  wireOrder,
} from "../src/index.mts";

export const FAKE_EXIT = (() => {}) as () => never;

const BASIC_BOOT = {
  configuration: { boilerplate: { LOG_LEVEL: "silent" } },
} as BootstrapOptions;

describe("Wiring", () => {
  let application: ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>;

  afterEach(async () => {
    if (application) {
      await application.teardown();
      application = undefined;
    }
    vi.restoreAllMocks();
  });

  // #MARK: CreateLibrary
  describe("CreateLibrary", () => {
    it("should be defined", () => {
      expect.assertions(2);
      expect(CreateLibrary).toBeDefined();
      expect(CreateApplication).toBeDefined();
    });

    it("should create a library without services", () => {
      expect.assertions(3);
      const library = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: {},
      });

      expect(library).toBeDefined();
      expect(library.name).toBe("testing");
      expect(library.services).toEqual({});
    });

    it("throws an error with invalid service definition", () => {
      expect.assertions(1);
      expect(() => {
        CreateLibrary({
          // @ts-expect-error For unit testing
          name: "testing",
          services: { InvalidService: undefined },
        });
      }).toThrow("INVALID_SERVICE_DEFINITION");
    });

    it("creates multiple libraries with distinct configurations", () => {
      expect.assertions(1);
      const libraryOne = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: {},
      });
      const libraryTwo = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing_second",
        services: {},
      });
      expect(libraryOne.name).not.toBe(libraryTwo.name);
    });

    it("throws a BootstrapException for an invalid service definition in a library", () => {
      expect.assertions(1);
      expect(() => {
        CreateLibrary({
          // @ts-expect-error For unit testing
          name: "testing",
          services: { invalidServiceDefinition: undefined },
        });
      }).toThrow(BootstrapException);
    });

    it("throws a BootstrapException if no name is provided for the library", () => {
      expect.assertions(1);
      expect(() => {
        // @ts-expect-error that's the test
        CreateLibrary({ name: "", services: {} });
      }).toThrow(BootstrapException);
    });
  });

  // #MARK: CreateApplication
  describe("CreateApplication", () => {
    it("should create an application with specified services and libraries", () => {
      expect.assertions(5);
      const testService = vi.fn();
      const testLibrary = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: { TestService: testService },
      });

      application = CreateApplication({
        configurationLoaders: [],
        libraries: [testLibrary],
        // @ts-expect-error For unit testing
        name: "testing",
        services: { AppService: vi.fn() },
      });

      expect(application).toBeDefined();
      expect(application.name).toBe("testing");
      expect(Object.keys(application.services).length).toBe(1);
      expect(application.libraries.length).toBe(1);
      expect(application.libraries[0]).toBe(testLibrary);
    });

    it("should only allows a single boot", async () => {
      expect.assertions(1);
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);
      try {
        await application.bootstrap(BASIC_BOOT);
      } catch (error) {
        expect(error.message).toBe("DOUBLE_BOOT");
      }
    });

    it("should allow appending services", async () => {
      expect.assertions(1);
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {},
      });
      await application.bootstrap({
        ...BASIC_BOOT,
        appendService: {
          Test() {
            // always true, the test is that it ran (expect.assertions)
            expect(true).toBe(true);
          },
        },
      });
    });

    it("should allow appending libraries", async () => {
      expect.assertions(1);
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {},
      });
      const testLibrary = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          TestService() {
            // always true, the test is that it ran (expect.assertions)
            expect(true).toBe(true);
          },
        },
      });

      await application.bootstrap({
        ...BASIC_BOOT,
        appendLibrary: testLibrary,
      });
    });

    it("should allow appending multiple libraries", async () => {
      expect.assertions(2);
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {},
      });

      const testLibrary = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          TestService() {
            // always true, the test is that it ran (expect.assertions)
            expect(true).toBe(true);
          },
        },
      });
      const testLibraryB = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing_b",
        services: {
          TestService() {
            // always true, the test is that it ran (expect.assertions)
            expect(true).toBe(true);
          },
        },
      });

      await application.bootstrap({
        ...BASIC_BOOT,
        appendLibrary: [testLibrary, testLibraryB],
      });
    });
  });

  // #MARK: Lifecycle
  describe("Lifecycle", () => {
    beforeEach(() => {
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {},
      });
    });

    it("should call the lifecycle events in order during application bootstrap", async () => {
      expect.assertions(5);
      const spyPreInit = vi.fn();
      const spyPostConfig = vi.fn();
      const spyBootstrap = vi.fn();
      const spyReady = vi.fn();

      await TestRunner().run(({ lifecycle }) => {
        lifecycle.onPreInit(spyPreInit);
        lifecycle.onPostConfig(spyPostConfig);
        lifecycle.onBootstrap(spyBootstrap);
        lifecycle.onReady(spyReady);
      });

      expect(spyPreInit).toHaveBeenCalled();
      expect(spyPostConfig).toHaveBeenCalled();
      expect(spyBootstrap).toHaveBeenCalled();
      expect(spyReady).toHaveBeenCalled();

      const callOrder = [
        spyPreInit.mock.invocationCallOrder[0],
        spyPostConfig.mock.invocationCallOrder[0],
        spyBootstrap.mock.invocationCallOrder[0],
        spyReady.mock.invocationCallOrder[0],
      ];
      expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
    });

    it("executes lifecycle callbacks in the correct order", async () => {
      expect.assertions(3);
      const mockPreInit = vi.fn();
      const mockPostConfig = vi.fn();
      const mockBootstrap = vi.fn();
      const mockReady = vi.fn();

      await TestRunner().run(({ lifecycle }) => {
        lifecycle.onPreInit(mockPreInit);
        lifecycle.onPostConfig(mockPostConfig);
        lifecycle.onBootstrap(mockBootstrap);
        lifecycle.onReady(mockReady);
      });

      const preInitOrder = mockPreInit.mock.invocationCallOrder[0];
      const postConfigOrder = mockPostConfig.mock.invocationCallOrder[0];
      const bootstrapOrder = mockBootstrap.mock.invocationCallOrder[0];
      const readyOrder = mockReady.mock.invocationCallOrder[0];

      expect(preInitOrder).toBeLessThan(postConfigOrder);
      expect(postConfigOrder).toBeLessThan(bootstrapOrder);
      expect(bootstrapOrder).toBeLessThan(readyOrder);
    });

    it("registers and invokes lifecycle callbacks correctly", async () => {
      expect.assertions(1);
      const mockCallback = vi.fn();

      await TestRunner().run(({ lifecycle }) => {
        lifecycle.onBootstrap(mockCallback);
      });

      expect(mockCallback).toHaveBeenCalled();
    });

    it("exits on catastrophic bootstrap errors", async () => {
      expect.assertions(1);
      const errorMock = vi.fn(() => {
        throw new Error("EXPECTED_UNIT_TESTING_ERROR");
      });
      vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(FAKE_EXIT);

      await TestRunner().run(({ lifecycle }) => {
        lifecycle.onBootstrap(errorMock);
      });

      expect(exitSpy).toHaveBeenCalled();
    });

    it("higher numbers go first (positive)", async () => {
      expect.assertions(1);
      const order: string[] = [];

      await TestRunner().run(({ lifecycle }) => {
        lifecycle.onBootstrap(() => order.push("7"), 7);
        lifecycle.onBootstrap(() => order.push("5"), 5);
        lifecycle.onBootstrap(() => order.push("3"), 3);
        lifecycle.onBootstrap(() => order.push("9"), 9);
        lifecycle.onBootstrap(() => order.push("1"), 1);
      });

      expect(order).toEqual([..."97531"]);
    });

    it("lower numbers go later (negative)", async () => {
      expect.assertions(1);
      const order: string[] = [];

      await TestRunner().run(({ lifecycle }) => {
        lifecycle.onBootstrap(() => order.push("7"), -7);
        lifecycle.onBootstrap(() => order.push("5"), -5);
        lifecycle.onBootstrap(() => order.push("3"), -3);
        lifecycle.onBootstrap(() => order.push("9"), -9);
        lifecycle.onBootstrap(() => order.push("1"), -1);
      });
      expect(order).toEqual([..."13579"]);
    });

    describe("Completed events", () => {
      it("starts off empty", async () => {
        expect.assertions(1);
        let list: LifecycleStages[];

        await TestRunner().run(({ lifecycle, internal }) => {
          lifecycle.onPreInit(() => (list = [...internal.boot.completedLifecycleEvents]));
        });

        expect(list).toEqual([]);
      });

      it("tracks onPreInit", async () => {
        expect.assertions(1);
        let list: LifecycleStages[];

        await TestRunner().run(({ lifecycle, internal }) => {
          lifecycle.onPostConfig(() => (list = [...internal.boot.completedLifecycleEvents]));
        });

        expect(list).toEqual(["PreInit"]);
      });

      it("tracks onPostConfig", async () => {
        expect.assertions(1);
        let list: LifecycleStages[];

        await TestRunner().run(({ lifecycle, internal }) => {
          lifecycle.onBootstrap(() => (list = [...internal.boot.completedLifecycleEvents]));
        });

        expect(list).toEqual(["PreInit", "PostConfig"]);
      });

      it("tracks onPreInit", async () => {
        expect.assertions(1);
        let list: LifecycleStages[];

        await TestRunner().run(({ lifecycle, internal }) => {
          lifecycle.onReady(() => (list = [...internal.boot.completedLifecycleEvents]));
        });

        expect(list).toEqual(["PreInit", "PostConfig", "Bootstrap"]);
      });

      it("tracks ready", async () => {
        let i: InternalDefinition;

        await TestRunner().run(({ internal }) => {
          i = internal;
        });

        expect([...i.boot.completedLifecycleEvents.values()]).toEqual([
          "PreInit",
          "PostConfig",
          "Bootstrap",
          "Ready",
        ]);
      });

      it("does not change by start of teardown", async () => {
        expect.assertions(1);
        let list: LifecycleStages[];

        const app = await TestRunner().run(({ lifecycle, internal }) => {
          lifecycle.onPreShutdown(() => (list = [...internal.boot.completedLifecycleEvents]));
        });

        application = undefined;
        await app.teardown();
        expect(list).toEqual(["PreInit", "PostConfig", "Bootstrap", "Ready"]);
      });

      it("tracks preShutdown", async () => {
        expect.assertions(1);
        let list: LifecycleStages[];

        const app = await TestRunner().run(({ lifecycle, internal }) => {
          lifecycle.onShutdownStart(() => (list = [...internal.boot.completedLifecycleEvents]));
        });

        await app.teardown();
        expect(list).toEqual(["PreInit", "PostConfig", "Bootstrap", "Ready", "PreShutdown"]);
      });

      it("tracks shutdownStart", async () => {
        expect.assertions(1);
        let list: LifecycleStages[];

        const app = await TestRunner().run(({ lifecycle, internal }) => {
          lifecycle.onShutdownComplete(() => (list = [...internal.boot.completedLifecycleEvents]));
        });
        await app.teardown();

        expect(list).toEqual([
          "PreInit",
          "PostConfig",
          "Bootstrap",
          "Ready",
          "PreShutdown",
          "ShutdownStart",
        ]);
      });

      it("tracks shutdownComplete", async () => {
        expect.assertions(1);
        let i: InternalDefinition;

        const app = await TestRunner().run(({ internal }) => {
          i = internal;
        });

        await app.teardown();
        expect([...i.boot.completedLifecycleEvents.values()]).toEqual([
          "PreInit",
          "PostConfig",
          "Bootstrap",
          "Ready",
          "PreShutdown",
          "ShutdownStart",
          "ShutdownComplete",
        ]);
      });
    });
  });

  // #MARK: Bootstrap
  describe("Bootstrap", () => {
    it("wireOrder throws errors for duplicates", () => {
      expect(() => {
        wireOrder(["a", "a", "b"], []);
      }).toThrow();
    });

    it("constructs app in between boot and ready for bootLibrariesFirst", async () => {
      expect.assertions(4);
      await TestRunner()
        .setOptions({ bootLibrariesFirst: true })
        .run(({ internal }) => {
          expect(internal.boot.completedLifecycleEvents.has("Bootstrap")).toBe(true);
          expect(internal.boot.completedLifecycleEvents.has("PreInit")).toBe(true);
          expect(internal.boot.completedLifecycleEvents.has("PostConfig")).toBe(true);
          expect(internal.boot.completedLifecycleEvents.has("Ready")).toBe(false);
        });
    });

    it("should prioritize services with priorityInit", async () => {
      expect.assertions(1);
      const list = [] as string[];

      await TestRunner()
        .appendLibrary(
          CreateLibrary({
            // @ts-expect-error testing
            name: "library",
            services: {
              First() {
                list.push("First");
              },
              Second() {
                list.push("Second");
              },
              Third() {
                list.push("Third");
              },
            },
          }),
        )
        .run(() => undefined);
      expect(list).toStrictEqual(["First", "Second", "Third"]);
    });

    it("includes extended stats with switch", async () => {
      const mockLogger = createMockLogger();
      const spy = vi.spyOn(mockLogger, "info");
      expect.assertions(1);
      const app = CreateApplication({
        // @ts-expect-error testing
        name: "app",
        services: {},
      });
      await app.bootstrap({
        customLogger: mockLogger,
        showExtraBootStats: true,
      });
      expect(spy).toHaveBeenCalledWith(
        "boilerplate:wiring",
        expect.objectContaining({
          Bootstrap: expect.any(String),
          Configure: expect.any(String),
          PostConfig: expect.any(String),
          PreInit: expect.any(String),
          Ready: expect.any(String),
          Total: expect.any(String),
        }),
        "[%s] application bootstrapped",
        "app",
      );
    });

    it("does not log extended boot stats by default", async () => {
      const mockLogger = createMockLogger();
      const spy = vi.spyOn(mockLogger, "info");
      expect.assertions(2);
      const app = CreateApplication({
        // @ts-expect-error testing
        name: "app",
        services: {},
      });
      await app.bootstrap({
        customLogger: mockLogger,
      });
      expect(spy).toHaveBeenCalledWith(
        "boilerplate:wiring",
        expect.objectContaining({
          Total: expect.any(String),
        }),
        "[%s] application bootstrapped",
        "app",
      );
      expect(spy).not.toHaveBeenCalledWith(
        "boilerplate:wiring",
        expect.objectContaining({
          Ready: expect.any(String),
        }),
        "[%s] application bootstrapped",
        "app",
      );
    });

    it("throws errors with missing priority services in apps", async () => {
      expect.assertions(1);
      expect(() => {
        CreateApplication({
          // @ts-expect-error testing
          name: "library",
          // @ts-expect-error testing
          priorityInit: ["missing"],
          services: {},
        });
      }).toThrow("MISSING_PRIORITY_SERVICE");
    });

    it("throws errors with missing priority libraries", async () => {
      expect.assertions(1);
      expect(() => {
        CreateLibrary({
          // @ts-expect-error testing
          name: "library",
          // @ts-expect-error testing
          priorityInit: ["missing"],
          services: {},
        });
      }).toThrow("MISSING_PRIORITY_SERVICE");
    });

    it("sets booted after finishing bootstrap", async () => {
      expect.assertions(1);

      const app = await TestRunner().run(() => undefined);
      expect(app.booted).toBe(true);
    });

    it("forbids double booting", async () => {
      expect.assertions(1);
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);

      // I guess this works 🤷‍♀️
      try {
        await application.bootstrap(BASIC_BOOT);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // #MARK: Boot Phase
  describe("Boot Phase", () => {
    it("should exit if service constructor throws error", async () => {
      expect.assertions(1);
      const spy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
      vi.spyOn(globalThis.console, "error").mockImplementation(() => undefined);

      await TestRunner().run(() => {
        throw new Error("boom");
      });
      expect(spy).toHaveBeenCalled();
    });

    it("should not have project name in construction complete prior to completion", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.boot.constructComplete.has("testing")).toBe(false);
      });
    });

    it("should add project name to complete", async () => {
      expect.assertions(1);

      await TestRunner().run(({ internal, lifecycle }) => {
        lifecycle.onPreInit(() => {
          expect(internal.boot.constructComplete.has("testing")).toBe(true);
        });
      });
    });

    it("phase should be bootstrap during boot", async () => {
      expect.assertions(1);

      await TestRunner().run(({ internal }) => {
        expect(internal.boot.phase).toBe("bootstrap");
      });
    });

    it("phase should be running when finished booting", async () => {
      expect.assertions(1);

      let i: InternalDefinition;
      await TestRunner().run(({ internal }) => {
        i = internal;
      });

      expect(i.boot.phase).toBe("running");
    });

    it("runs hooks automatically if provided late", async () => {
      expect.assertions(1);

      await TestRunner().run(({ lifecycle }) => {
        const spy = vi.fn();
        lifecycle.onReady(() => {
          lifecycle.onBootstrap(spy);
          // run immediately
          expect(spy).toHaveBeenCalled();
        });
      });
    });
  });

  // #MARK: Teardown
  describe("Teardown", () => {
    describe("async shutdown hooks", () => {
      it("happy path", async () => {
        expect.assertions(1);
        const list: string[] = [];
        const app = await TestRunner().run(({ lifecycle }) => {
          lifecycle.onPreShutdown(async () => {
            list.push("1");
            await sleep(5);
            list.push("2");
          });
          lifecycle.onShutdownStart(async () => {
            list.push("3");
            await sleep(5);
            list.push("4");
          });
          lifecycle.onShutdownComplete(async () => {
            list.push("5");
            await sleep(5);
            list.push("6");
          });
        });
        await app.teardown();

        expect(list).toEqual([..."123456"]);
      });

      it("unhappy path", async () => {
        expect.assertions(1);
        vi.spyOn(console, "error").mockImplementation(() => {});
        const list: string[] = [];
        const app = await TestRunner().run(({ lifecycle }) => {
          lifecycle.onPreShutdown(async () => {
            list.push("1");
            await sleep(5);
            list.push("2");
          });
          lifecycle.onShutdownStart(async () => {
            list.push("3");
            throw new Error("test");
            // list.push("4");
          });
          lifecycle.onShutdownComplete(async () => {
            list.push("5");
            await sleep(5);
            list.push("6");
          });
        });
        await app.teardown();

        expect(list).toEqual([..."123"]);
      });
    });

    it("shouldn't process double teardown", async () => {
      expect.assertions(1);
      const spy = vi.spyOn(globalThis.console, "error").mockImplementation(() => undefined);
      const app = await TestRunner().run(({ lifecycle }) => {
        lifecycle.onPreShutdown(() => {
          throw new Error("test");
        });
      });
      await app.teardown();

      expect(spy).toHaveBeenCalledWith(
        expect.any(Object),
        "error occurred during teardown, some lifecycle events may be incomplete",
      );
    });

    it("shouldn't process double teardown pt2", async () => {
      expect.assertions(1);
      const spy = vi.fn();
      const app = await TestRunner().run(({ lifecycle }) => {
        lifecycle.onPreShutdown(spy);
      });
      await Promise.all([app.teardown(), app.teardown(), app.teardown()]);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("phase should be teardown after teardown starts", async () => {
      expect.assertions(1);

      const app = await TestRunner().run(({ internal, lifecycle }) => {
        lifecycle.onPreShutdown(() => {
          expect(internal.boot.phase).toBe("teardown");
        });
      });
      await app.teardown();
    });

    it("should shutdown on SIGTERM", async () => {
      expect.assertions(2);
      const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

      const spy = vi.fn();
      await TestRunner().run(({ lifecycle }) => {
        lifecycle.onPreShutdown(spy);
      });
      process.emit("SIGTERM");
      await new Promise<void>(done => setTimeout(done, 10));

      expect(spy).toHaveBeenCalled();
      expect(exit).toHaveBeenCalled();
      application = undefined;
    });

    it("should shutdown on SIGINT", async () => {
      expect.assertions(2);
      const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

      const spy = vi.fn();

      await TestRunner().run(({ lifecycle }) => {
        lifecycle.onPreShutdown(spy);
      });
      process.emit("SIGINT");
      await new Promise<void>(done => setTimeout(done, 10));

      expect(spy).toHaveBeenCalled();
      expect(exit).toHaveBeenCalled();
      application = undefined;
    });
  });

  // #MARK: Internal
  describe("Internal", () => {
    it("populates maps during bootstrap", async () => {
      expect.assertions(1);
      let i: InternalDefinition;
      await TestRunner().run(({ internal }) => {
        i = internal;
      });
      expect(i.boot.constructComplete.size).not.toEqual(0);
    });

    it("has config alias", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.config).toBe(internal.boilerplate.configuration);
      });
    });
  });

  // #MARK: Wiring
  describe("Wiring", () => {
    it("has recursive service params", async () => {
      expect.assertions(2);
      await TestRunner().run(({ params }) => {
        expect(params).toBeDefined();
        expect(params.params).toBe(params);
      });
    });
    it("should allow 2 separate apps to boot", async () => {
      expect.assertions(1);
      await expect(async () => {
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test() {},
          },
        });
        await application.bootstrap(BASIC_BOOT);
        const secondary = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing_second",
          services: {
            Test() {},
          },
        });
        await secondary.bootstrap(BASIC_BOOT);
        await secondary.teardown();
      }).not.toThrow();
    });

    it("should replace libraries with conflicting names", async () => {
      expect.assertions(2);
      const test = vi.fn();
      const testLibrary = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          TestService() {
            test("A");
          },
        },
      });
      const testLibraryB = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          TestService() {
            test("B");
          },
        },
      });
      application = CreateApplication({
        configurationLoaders: [],
        libraries: [testLibrary],
        // @ts-expect-error Testing
        name: "testing",
        services: {},
      });
      await application.bootstrap({
        ...BASIC_BOOT,
        appendLibrary: testLibraryB,
      });
      expect(test).toHaveBeenCalledWith("B");
      expect(test).not.toHaveBeenCalledWith("A");
    });

    it("should add library to TServiceParams", async () => {
      expect.assertions(1);
      await TestRunner().run(params => {
        expect("testing" in params).toBe(true);
      });
    });

    it("should use service context as keys in assembled api", async () => {
      let foo: string;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        priorityInit: ["First"],
        services: {
          First() {
            return { foo: "bar" };
          },
          // @ts-expect-error Testing
          Second({ testing }: TServiceParams) {
            foo = testing.First.foo;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(foo).toEqual("bar");
    });

    it("passes standard utils into services", async () => {
      expect.assertions(6);
      await TestRunner().run(({ lifecycle, logger, scheduler, event, config, context }) => {
        expect(lifecycle).toBeDefined();
        expect(logger).toBeDefined();
        expect(scheduler).toBeDefined();
        expect(event).toBeDefined();
        expect(config).toBeDefined();
        expect(context).toBeDefined();
      });
    });
  });

  // #MARK: Mixing
  describe("Application + Library interactions", () => {
    let list: string[];
    const LIBRARY_A = CreateLibrary({
      // @ts-expect-error testing
      name: "A",
      services: {
        AddToList: () => list.push("A"),
      },
    });
    const LIBRARY_B = CreateLibrary({
      depends: [LIBRARY_A],
      // @ts-expect-error testing
      name: "B",
      services: {
        AddToList: () => list.push("B"),
      },
    });

    const LIBRARY_C = CreateLibrary({
      depends: [LIBRARY_A, LIBRARY_B],
      // @ts-expect-error testing
      name: "C",
      services: {
        AddToList: () => list.push("C"),
      },
    });

    const LIBRARY_D = CreateLibrary({
      depends: [LIBRARY_A],
      // @ts-expect-error testing
      name: "D",

      optionalDepends: [LIBRARY_B],
      services: {
        AddToList: () => list.push("C"),
      },
    });

    const LIBRARY_E = CreateLibrary({
      // depends: [LIBRARY_F],
      // @ts-expect-error testing
      name: "E",

      optionalDepends: [LIBRARY_B],
      services: {
        AddToList: () => list.push("C"),
      },
    });

    const LIBRARY_F = CreateLibrary({
      depends: [LIBRARY_E],
      // @ts-expect-error testing
      name: "F",

      optionalDepends: [LIBRARY_B],
      services: {
        AddToList: () => list.push("C"),
      },
    });
    LIBRARY_E.depends = [LIBRARY_F];

    beforeEach(() => {
      list = [];
    });

    it("buildSortOrder", () => {
      const logger = createMockLogger();
      expect(() => {
        buildSortOrder(
          CreateApplication({
            libraries: [LIBRARY_E, LIBRARY_F],
            // @ts-expect-error testing
            name: "test",
            services: {},
          }),
          logger,
        );
      }).toThrow(BootstrapException);
    });

    it("should pass through optionalDepends", () => {
      expect(LIBRARY_D.optionalDepends).toBeDefined();
    });

    it("should wire libraries in the correct order", async () => {
      // Provided in C -> A -> B
      // Needs to be loaded in A -> B -> C
      application = CreateApplication({
        libraries: [LIBRARY_C, LIBRARY_A, LIBRARY_B],
        // @ts-expect-error testing
        name: "testing",
        services: {},
      });

      await application.bootstrap(BASIC_BOOT);
      expect(list).toEqual(["A", "B", "C"]);
    });

    it("should throw errors if a dependency is missing from the app", async () => {
      application = CreateApplication({
        configurationLoaders: [],
        libraries: [LIBRARY_C, LIBRARY_B],
        // @ts-expect-error testing
        name: "testing",
        services: {},
      });
      const failFastSpy = vi.spyOn(process, "exit").mockImplementation(FAKE_EXIT);
      expect.assertions(1);
      await application.bootstrap(BASIC_BOOT);
      expect(failFastSpy).toHaveBeenCalled();
    });

    it("should not throw errors if a optional dependency is missing from the app", async () => {
      application = CreateApplication({
        configurationLoaders: [],
        libraries: [LIBRARY_A, LIBRARY_D],
        // @ts-expect-error testing
        name: "testing",
        services: {},
      });
      const failFastSpy = vi.spyOn(process, "exit").mockImplementation(FAKE_EXIT);
      expect.assertions(1);
      await application.bootstrap(BASIC_BOOT);
      expect(failFastSpy).not.toHaveBeenCalled();
    });

    it("should allow name compatible library substitutions", async () => {
      application = CreateApplication({
        configurationLoaders: [],
        libraries: [
          LIBRARY_C,
          LIBRARY_B,
          CreateLibrary({
            // @ts-expect-error testing
            name: "A",
            services: {
              AddToList: () => list.push("A"),
            },
          }),
        ],
        // @ts-expect-error testing
        name: "testing",
        services: {},
      });
      const failFastSpy = vi.spyOn(process, "exit").mockImplementation(FAKE_EXIT);
      await application.bootstrap(BASIC_BOOT);
      expect(list).toEqual(["A", "B", "C"]);
      expect(failFastSpy).not.toHaveBeenCalled();
    });
  });

  describe("Debug features", () => {
    it("emits warnings for library version mismatches", async () => {
      expect.assertions(1);
      process.env.NODE_ENV = "not_test";
      // @ts-expect-error testing
      const a = CreateLibrary({ name: "A", services: {} });
      // @ts-expect-error testing
      const b = CreateLibrary({ depends: [a], name: "B", services: {} });
      // @ts-expect-error testing
      const other_a = CreateLibrary({ name: "A", services: {} });

      let hit = false;
      vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
      vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
      vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
      vi.spyOn(globalThis.console, "warn").mockImplementation((text: string) => {
        hit ||= text?.includes("depends different version");
      });
      const customLogger = createMockLogger();
      const runner = await createModule
        .fromApplication(
          CreateApplication({
            libraries: [b, other_a],
            // @ts-expect-error testing
            name: "test_app",
          }),
        )
        .extend()
        .toTest()
        .emitLogs()
        .setOptions({ customLogger });

      await runner.run(({ lifecycle }) => {
        lifecycle.onReady(() => {
          expect(hit).toBe(true);
        });
      });
    });
  });
});
