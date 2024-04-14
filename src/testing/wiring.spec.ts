import {
  ApplicationDefinition,
  BootstrapException,
  BootstrapOptions,
  CreateApplication,
  CreateLibrary,
  InternalDefinition,
  LIB_BOILERPLATE,
  LifecycleStages,
  LOADED_LIFECYCLES,
  LOADED_MODULES,
  MODULE_MAPPINGS,
  OptionalModuleConfiguration,
  REVERSE_MODULE_MAPPING,
  ServiceMap,
  TServiceParams,
  WIRE_PROJECT,
} from "..";

const FAKE_EXIT = (() => {}) as () => never;

const BASIC_BOOT = {
  configuration: { boilerplate: { LOG_LEVEL: "silent" } },
  hideLogLevel: true,
} as BootstrapOptions;

describe("Wiring", () => {
  let application: ApplicationDefinition<
    ServiceMap,
    OptionalModuleConfiguration
  >;

  afterEach(async () => {
    if (application) {
      await application.teardown();
      application = undefined;
    }
    jest.restoreAllMocks();
  });

  // #region CreateLibrary
  describe("CreateLibrary", () => {
    it("should be defined", () => {
      expect(CreateLibrary).toBeDefined();
      expect(CreateApplication).toBeDefined();
    });

    it("should create a library without services", () => {
      const library = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: {},
      });

      expect(library).toBeDefined();
      expect(library.name).toBe("testing");
      expect(library.services).toEqual({});
    });

    it("properly wires services when creating a library", async () => {
      const testService = jest.fn();
      const library = CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: { testService },
      });
      await library[WIRE_PROJECT](undefined);
      // Check that the service is wired correctly
      expect(testService).toHaveBeenCalled();
    });
    it("throws an error with invalid service definition", () => {
      expect(() => {
        CreateLibrary({
          // @ts-expect-error For unit testing
          name: "testing",
          services: { InvalidService: undefined },
        });
      }).toThrow("INVALID_SERVICE_DEFINITION");
    });

    it("creates multiple libraries with distinct configurations", () => {
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
      expect(() => {
        CreateLibrary({
          // @ts-expect-error For unit testing
          name: "testing",
          services: { invalidServiceDefinition: undefined },
        });
      }).toThrow(BootstrapException);
    });

    it("throws a BootstrapException if no name is provided for the library", () => {
      expect(() => {
        // @ts-expect-error that's the test
        CreateLibrary({ name: "", services: {} });
      }).toThrow(BootstrapException);
    });
  });
  // #endregion

  // #region CreateApplication
  describe("CreateApplication", () => {
    it("should create an application with specified services and libraries", () => {
      const testService = jest.fn();
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
        services: { AppService: jest.fn() },
      });

      expect(application).toBeDefined();
      expect(application.name).toBe("testing");
      expect(Object.keys(application.services).length).toBe(1);
      expect(application.libraries.length).toBe(1);
      expect(application.libraries[0]).toBe(testLibrary);
    });
  });
  // #endregion

  // #region Lifecycle
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
      // Spy on lifecycle event functions
      const spyPreInit = jest.fn();
      const spyPostConfig = jest.fn();
      const spyBootstrap = jest.fn();
      const spyReady = jest.fn();
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          spy({ lifecycle }: TServiceParams) {
            lifecycle.onPreInit(() => spyPreInit());
            lifecycle.onPostConfig(() => spyPostConfig());
            lifecycle.onBootstrap(() => spyBootstrap());
            lifecycle.onReady(() => spyReady());
          },
        },
      });

      // Bootstrap the application
      await application.bootstrap(BASIC_BOOT);

      // Check that the lifecycle event functions were called
      expect(spyPreInit).toHaveBeenCalled();
      expect(spyPostConfig).toHaveBeenCalled();
      expect(spyBootstrap).toHaveBeenCalled();
      expect(spyReady).toHaveBeenCalled();

      // Optionally, check the calling order
      const callOrder = [
        spyPreInit.mock.invocationCallOrder[0],
        spyPostConfig.mock.invocationCallOrder[0],
        spyBootstrap.mock.invocationCallOrder[0],
        spyReady.mock.invocationCallOrder[0],
      ];
      expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
    });

    it("executes lifecycle callbacks in the correct order", async () => {
      // Mock callbacks for each lifecycle stage
      const mockPreInit = jest.fn();
      const mockPostConfig = jest.fn();
      const mockBootstrap = jest.fn();
      const mockReady = jest.fn();
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          spy({ lifecycle }: TServiceParams) {
            lifecycle.onPreInit(() => mockPreInit());
            lifecycle.onPostConfig(() => mockPostConfig());
            lifecycle.onBootstrap(() => mockBootstrap());
            lifecycle.onReady(() => mockReady());
          },
        },
      });

      // Bootstrap the application
      await application.bootstrap(BASIC_BOOT);

      // Retrieve the order in which the mocks were called
      const preInitOrder = mockPreInit.mock.invocationCallOrder[0];
      const postConfigOrder = mockPostConfig.mock.invocationCallOrder[0];
      const bootstrapOrder = mockBootstrap.mock.invocationCallOrder[0];
      const readyOrder = mockReady.mock.invocationCallOrder[0];

      // Verify the order of callback execution
      expect(preInitOrder).toBeLessThan(postConfigOrder);
      expect(postConfigOrder).toBeLessThan(bootstrapOrder);
      expect(bootstrapOrder).toBeLessThan(readyOrder);
    });

    it("registers and invokes lifecycle callbacks correctly", async () => {
      const mockCallback = jest.fn();

      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          spy({ lifecycle }: TServiceParams) {
            lifecycle.onBootstrap(() => mockCallback());
          },
        },
      });

      // Bootstrap the application
      await application.bootstrap(BASIC_BOOT);

      // Check if the mock callback was invoked
      expect(mockCallback).toHaveBeenCalled();
    });

    it("exits on catastrophic bootstrap errors", async () => {
      const errorMock = jest.fn().mockImplementation(() => {
        throw new Error("EXPECTED_UNIT_TESTING_ERROR");
      });

      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          spy({ lifecycle }: TServiceParams) {
            lifecycle.onBootstrap(() => errorMock());
          },
        },
      });

      jest.spyOn(console, "error").mockImplementation(() => {});
      const failFastSpy = jest
        .spyOn(process, "exit")
        .mockImplementation(FAKE_EXIT);

      // Execute the Bootstrap function
      await application.bootstrap(BASIC_BOOT);

      // Check if FailFast was called
      expect(failFastSpy).toHaveBeenCalled();
    });

    it("higher numbers go first (positive)", async () => {
      const executionOrder: string[] = [];

      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          spy({ lifecycle }: TServiceParams) {
            lifecycle.onBootstrap(
              () => executionOrder.push("LowPriorityBootstrap"),
              1,
            );
            lifecycle.onBootstrap(
              () => executionOrder.push("HighPriorityBootstrap"),
              10,
            );
          },
        },
      });

      await application.bootstrap(BASIC_BOOT);

      // Define the expected order based on priorities
      const expectedOrder = ["HighPriorityBootstrap", "LowPriorityBootstrap"];

      // Compare the actual execution order with the expected order
      expect(executionOrder).toEqual(expectedOrder);
    });

    it("lower numbers go later (negative)", async () => {
      const executionOrder: string[] = [];

      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          spy({ lifecycle }: TServiceParams) {
            lifecycle.onBootstrap(
              () => executionOrder.push("LowPriorityBootstrap"),
              -1,
            );
            lifecycle.onBootstrap(
              () => executionOrder.push("HighPriorityBootstrap"),
              -10,
            );
          },
        },
      });

      await application.bootstrap(BASIC_BOOT);

      // Define the expected order based on priorities
      const expectedOrder = ["HighPriorityBootstrap", "LowPriorityBootstrap"];

      // Compare the actual execution order with the expected order
      expect(executionOrder).toEqual(expectedOrder);
    });

    describe("Completed events", () => {
      it("starts off empty", async () => {
        let list: LifecycleStages[];
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test({ lifecycle, internal }: TServiceParams) {
              lifecycle.onPreInit(
                () => (list = [...internal.boot.completedLifecycleEvents]),
              );
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
        expect(list).toEqual([]);
      });

      it("tracks onPreInit", async () => {
        let list: LifecycleStages[];
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test({ lifecycle, internal }: TServiceParams) {
              lifecycle.onPostConfig(
                () => (list = [...internal.boot.completedLifecycleEvents]),
              );
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
        expect(list).toEqual(["PreInit"]);
      });

      it("tracks onPostConfig", async () => {
        let list: LifecycleStages[];
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test({ lifecycle, internal }: TServiceParams) {
              lifecycle.onBootstrap(
                () => (list = [...internal.boot.completedLifecycleEvents]),
              );
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
        expect(list).toEqual(["PreInit", "PostConfig"]);
      });

      it("tracks onPreInit", async () => {
        let list: LifecycleStages[];
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test({ lifecycle, internal }: TServiceParams) {
              lifecycle.onReady(
                () => (list = [...internal.boot.completedLifecycleEvents]),
              );
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
        expect(list).toEqual(["PreInit", "PostConfig", "Bootstrap"]);
      });

      it("tracks ready", async () => {
        let i: InternalDefinition;
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test({ internal }: TServiceParams) {
              i = internal;
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
        expect([...i.boot.completedLifecycleEvents.values()]).toEqual([
          "PreInit",
          "PostConfig",
          "Bootstrap",
          "Ready",
        ]);
      });

      it("does not change by start of teardown", async () => {
        let list: LifecycleStages[];
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test({ lifecycle, internal }: TServiceParams) {
              lifecycle.onPreShutdown(
                () => (list = [...internal.boot.completedLifecycleEvents]),
              );
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
        await application.teardown();
        application = undefined;
        expect(list).toEqual(["PreInit", "PostConfig", "Bootstrap", "Ready"]);
      });

      it("tracks preShutdown", async () => {
        let list: LifecycleStages[];
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test({ lifecycle, internal }: TServiceParams) {
              lifecycle.onShutdownStart(
                () => (list = [...internal.boot.completedLifecycleEvents]),
              );
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
        await application.teardown();
        application = undefined;
        expect(list).toEqual([
          "PreInit",
          "PostConfig",
          "Bootstrap",
          "Ready",
          "PreShutdown",
        ]);
      });

      it("tracks shutdownStart", async () => {
        let list: LifecycleStages[];
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test({ lifecycle, internal }: TServiceParams) {
              lifecycle.onShutdownComplete(
                () => (list = [...internal.boot.completedLifecycleEvents]),
              );
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
        await application.teardown();
        application = undefined;
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
        let i: InternalDefinition;
        application = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          services: {
            Test({ internal }: TServiceParams) {
              i = internal;
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
        await application.teardown();
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
  // #endregion

  // #region Bootstrap
  describe("Bootstrap", () => {
    it("should prioritize services with priorityInit", async () => {
      const list = [] as string[];
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        priorityInit: ["First", "Second"],
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
      });
      //
      await application.bootstrap(BASIC_BOOT);
      expect(list).toStrictEqual(["First", "Second", "Third"]);
    });

    it("throws errors with missing priority services", async () => {
      expect(() => {
        CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "testing",
          priorityInit: ["Testing"],
          services: {
            NotTesting() {},
          },
        });
      }).toThrow("MISSING_PRIORITY_SERVICE");
    });

    it("sets booted after finishing bootstrap", async () => {
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);

      expect(application.booted).toBe(true);
    });

    it("forbids double booting", async () => {
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);

      // I guess this works 🤷‍♀️
      expect.assertions(1);
      try {
        await application.bootstrap(BASIC_BOOT);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
  // #endregion

  // #region Boot Phase
  describe("Boot Phase", () => {
    it("phase should be bootstrap during boot", async () => {
      let i: string;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Service({ internal }: TServiceParams) {
            i = internal.boot.phase;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);

      expect(i).toBe("bootstrap");
    });

    it("phase should be running when finished booting", async () => {
      let i: InternalDefinition;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Service({ internal }: TServiceParams) {
            i = internal;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);

      expect(i.boot.phase).toBe("running");
    });

    it("phase should be teardown after teardown starts", async () => {
      let i: string;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Service({ internal, lifecycle }: TServiceParams) {
            lifecycle.onPreShutdown(() => {
              i = internal.boot.phase;
            });
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      await application.teardown();
      application = undefined;

      expect(i).toBe("teardown");
    });
  });
  // #endregion

  // #region Teardown
  describe("Teardown", () => {
    it("phase should be teardown after teardown starts", async () => {
      let i: string;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Service({ internal, lifecycle }: TServiceParams) {
            lifecycle.onPreShutdown(() => {
              i = internal.boot.phase;
            });
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      await application.teardown();
      application = undefined;

      expect(i).toBe("teardown");
    });
  });
  // #endregion

  // #region Internal
  describe("Internal", () => {
    it("populates maps during bootstrap", async () => {
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);
      expect(MODULE_MAPPINGS.size).not.toEqual(0);
      expect(LOADED_MODULES.size).not.toEqual(0);
      expect(REVERSE_MODULE_MAPPING.size).not.toEqual(0);
      expect(LOADED_LIFECYCLES.size).not.toEqual(0);
      expect(LIB_BOILERPLATE).toBeDefined();
    });
  });
  // #endregion

  // #region Wiring
  describe("Wiring", () => {
    it("should add library to TServiceParams", async () => {
      let observed: unknown;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        priorityInit: ["First"],
        services: {
          // @ts-expect-error Testing
          First({ testing }: TServiceParams) {
            observed = testing;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(observed).toBeDefined();
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

    it("passes lifecycle into services", async () => {
      let observed: unknown;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Test({ lifecycle }: TServiceParams) {
            observed = lifecycle;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(observed).toBeDefined();
    });

    it("passes logger into services", async () => {
      let observed: unknown;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Test({ logger }: TServiceParams) {
            observed = logger;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(observed).toBeDefined();
    });

    it("passes scheduler into services", async () => {
      let observed: unknown;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Test({ scheduler }: TServiceParams) {
            observed = scheduler;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(observed).toBeDefined();
    });

    it("passes cache into services", async () => {
      let observed: unknown;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Test({ cache }: TServiceParams) {
            observed = cache;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(observed).toBeDefined();
    });

    it("passes event into services", async () => {
      let observed: unknown;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Test({ event }: TServiceParams) {
            observed = event;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(observed).toBeDefined();
    });

    it("passes config into services", async () => {
      let observed: unknown;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Test({ config }: TServiceParams) {
            observed = config;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(observed).toBeDefined();
    });

    it("passes context into services", async () => {
      let observed: unknown;
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error Testing
        name: "testing",
        services: {
          Test({ context }: TServiceParams) {
            observed = context;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(observed).toBeDefined();
    });
  });
  // #endregion

  // #region Mixing
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

    beforeEach(() => {
      list = [];
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
      const failFastSpy = jest
        .spyOn(process, "exit")
        .mockImplementation(FAKE_EXIT);
      expect.assertions(1);
      await application.bootstrap(BASIC_BOOT);
      expect(failFastSpy).toHaveBeenCalled();
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
      const failFastSpy = jest
        .spyOn(process, "exit")
        .mockImplementation(FAKE_EXIT);
      await application.bootstrap(BASIC_BOOT);
      expect(list).toEqual(["A", "B", "C"]);
      expect(failFastSpy).not.toHaveBeenCalled();
    });
  });
});
