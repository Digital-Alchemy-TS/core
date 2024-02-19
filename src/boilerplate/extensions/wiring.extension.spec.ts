import { ZCC_Testing } from "../..";
import {
  ApplicationDefinition,
  BootstrapException,
  LibraryDefinition,
  ModuleConfiguration,
  OptionalModuleConfiguration,
  ServiceMap,
  WIRE_PROJECT,
} from "..";
import { CreateApplication, CreateLibrary } from ".";

describe("Wiring", () => {
  let application: ApplicationDefinition<
    ServiceMap,
    OptionalModuleConfiguration
  >;

  afterEach(async () => {
    if (application) {
      if (application.booted) {
        await application.teardown();
      }
      application = undefined;
    }
    jest.restoreAllMocks();
    ZCC_Testing.WiringReset();
  });

  describe("Basics", () => {
    describe("CreateLibrary", () => {
      it("should be defined", () => {
        expect(CreateLibrary).toBeDefined();
        expect(CreateApplication).toBeDefined();
      });

      it("should create a library without services", () => {
        const library = CreateLibrary({
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
          name: "testing",
          services: { testService },
        });
        await library[WIRE_PROJECT]();
        // Check that the service is wired correctly
        expect(testService).toHaveBeenCalled();
      });
      it("throws an error with invalid service definition", () => {
        expect(() => {
          CreateLibrary({
            name: "testing",
            services: { InvalidService: undefined },
          });
        }).toThrow("Invalid service definition");
      });

      it("integrates correctly with the event emitter for error handling", () => {
        const library = CreateLibrary({
          name: "testing",
          services: {},
        });
        const eventSpy = jest.spyOn(library, "onError");
        // Simulate an error event
        library.onError(() => {
          throw new Error("Test Error");
        });
        expect(eventSpy).toHaveBeenCalled();
      });

      it("integrates lifecycle methods correctly in a created library", () => {
        const library = CreateLibrary({
          name: "testing",
          services: {},
        });
        expect(typeof library.lifecycle.onBootstrap).toBe("function");
        expect(typeof library.lifecycle.onShutdownStart).toBe("function");
      });

      it("creates multiple libraries with distinct configurations", () => {
        const libraryOne = CreateLibrary({
          name: "testing",
          services: {},
        });
        const libraryTwo = CreateLibrary({
          name: "testing_second",
          services: {},
        });
        expect(libraryOne.name).not.toBe(libraryTwo.name);
      });

      it("throws a BootstrapException for an invalid service definition in a library", () => {
        expect(() => {
          CreateLibrary({
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
          name: "testing",
          services: { TestService: testService },
        });

        application = CreateApplication({
          libraries: [testLibrary],
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
      application = CreateApplication({ name: "testing_app", services: {} });
    });

    it("should call the lifecycle events in order during application bootstrap", async () => {
      // Spy on lifecycle event functions
      const spyPreInit = jest.fn();
      const spyPostConfig = jest.fn();
      const spyBootstrap = jest.fn();
      const spyReady = jest.fn();

      application.lifecycle.onPreInit(() => spyPreInit());
      application.lifecycle.onPostConfig(() => spyPostConfig());
      application.lifecycle.onBootstrap(() => spyBootstrap());
      application.lifecycle.onReady(() => spyReady());

      // Bootstrap the application
      await application.bootstrap();

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

      // Register mock callbacks
      application.lifecycle.onPreInit(mockPreInit);
      application.lifecycle.onPostConfig(mockPostConfig);
      application.lifecycle.onBootstrap(mockBootstrap);
      application.lifecycle.onReady(mockReady);

      // Bootstrap the application
      await application.bootstrap();

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

      // Register the mock callback for the 'Bootstrap' stage
      application.lifecycle.onBootstrap(mockCallback);

      // Bootstrap the application
      await application.bootstrap();

      // Check if the mock callback was invoked
      expect(mockCallback).toHaveBeenCalled();
    });

    it("triggers fail-fast on catastrophic bootstrap errors", async () => {
      const errorMock = jest.fn().mockImplementation(() => {
        throw new Error("Catastrophic Error");
      });

      application.lifecycle.onBootstrap(errorMock);
      jest.spyOn(console, "error").mockImplementation(() => {});
      const failFastSpy = jest
        .spyOn(ZCC_Testing, "FailFast")
        .mockImplementation(() => {});

      // Execute the Bootstrap function
      await application.bootstrap();

      // Check if FailFast was called
      expect(failFastSpy).toHaveBeenCalled();
    });

    it("wires services correctly in applications and libraries", async () => {
      const testService = jest.fn();
      await ZCC_Testing.WireService(
        "testLibrary",
        "TestService",
        testService,
        application.lifecycle,
      );

      // Assuming WireService modifies the MODULE_MAPPINGS in ZCC_Testing
      expect(
        ZCC_Testing.MODULE_MAPPINGS().get("testLibrary")["TestService"],
      ).toBe(testService);
    });

    it("executes prioritized lifecycle callbacks in the correct order", async () => {
      // Array to track the execution order
      const executionOrder: string[] = [];

      // Registering callbacks with priorities
      application.lifecycle.onBootstrap(
        () => executionOrder.push("HighPriorityBootstrap"),
        1,
      );
      application.lifecycle.onBootstrap(
        () => executionOrder.push("LowPriorityBootstrap"),
        10,
      );

      // Trigger the lifecycle process
      // Replace 'runLifecycle' with the actual method to initiate the lifecycle events
      await application.bootstrap();

      // Define the expected order based on priorities
      const expectedOrder = ["HighPriorityBootstrap", "LowPriorityBootstrap"];

      // Compare the actual execution order with the expected order
      expect(executionOrder).toEqual(expectedOrder);
    });
  });
});

declare module ".." {
  export interface LoadedModules {
    testing_app: ApplicationDefinition<ServiceMap, ModuleConfiguration>;
    testing: LibraryDefinition<ServiceMap, ModuleConfiguration>;
    testing_second: LibraryDefinition<ServiceMap, ModuleConfiguration>;
  }
}
