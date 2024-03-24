import exp from "constants";

import {
  ApplicationDefinition,
  BootstrapException,
  BootstrapOptions,
  CreateApplication,
  CreateLibrary,
  OptionalModuleConfiguration,
  ServiceMap,
  TServiceParams,
  WIRE_PROJECT,
} from "..";

const FAKE_EXIT = (() => {}) as () => never;

const BASIC_BOOT = {
  configuration: { boilerplate: { LOG_LEVEL: "error" } },
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

  describe("Basics", () => {
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

    describe("CreateApplication Function", () => {
      it("should create an application with specified services and libraries", () => {
        const testService = jest.fn();
        const testLibrary = CreateLibrary({
          // @ts-expect-error For unit testing
          name: "testing",
          services: { TestService: testService },
        });

        application = CreateApplication({
          libraries: [testLibrary],
          // @ts-expect-error For unit testing
          name: "testing_app",
          services: { AppService: jest.fn() },
        });

        expect(application).toBeDefined();
        expect(application.name).toBe("testing_app");
        expect(Object.keys(application.services).length).toBe(1);
        expect(application.libraries.length).toBe(1);
        expect(application.libraries[0]).toBe(testLibrary);
      });
    });
  });

  describe("Application Lifecycle", () => {
    beforeEach(() => {
      application = CreateApplication({
        // @ts-expect-error For unit testing
        name: "testing_app",
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
        // @ts-expect-error For unit testing
        name: "testing_app",
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
        // @ts-expect-error For unit testing
        name: "testing_app",
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
        // @ts-expect-error For unit testing
        name: "testing_app",
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

    it("triggers fail-fast on catastrophic bootstrap errors", async () => {
      const errorMock = jest.fn().mockImplementation(() => {
        throw new Error("EXPECTED_UNIT_TESTING_ERROR");
      });

      application = CreateApplication({
        // @ts-expect-error For unit testing
        name: "testing_app",
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
        // @ts-expect-error For unit testing
        name: "testing_app",
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
        // @ts-expect-error For unit testing
        name: "testing_app",
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
  });

  describe("Bootstrap", () => {
    it("should prioritize services with priorityInit", async () => {
      const list = [] as string[];
      application = CreateApplication({
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
        // @ts-expect-error Testing
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);

      expect(application.booted).toBe(true);
    });

    it("forbids double booting", async () => {
      application = CreateApplication({
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

  describe("Wiring", () => {
    it("should add library to TServiceParams", async () => {
      let observed: unknown;
      application = CreateApplication({
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

    describe.skip("app + library interactions", () => {
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
        application = CreateApplication({
          libraries: [
            //
            LIBRARY_B,
            LIBRARY_C,
            LIBRARY_A,
          ],
          // @ts-expect-error testing
          name: "testing",
          services: {},
        });

        await application.bootstrap(BASIC_BOOT);
        expect(list).toEqual(["A", "B", "C"]);
      });
    });
  });
});
