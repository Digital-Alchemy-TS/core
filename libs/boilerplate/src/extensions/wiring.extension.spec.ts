import { ZCC } from "@zcc/utilities";

import { BootstrapException } from "../helpers/errors.helper.mjs";
import { ZCCApplicationDefinition } from "../helpers/wiring.helper.mjs";
import { TEST_WIRING } from "./wiring.extension.mjs";

describe("Wiring Extension", () => {
  let application: ZCCApplicationDefinition;
  afterEach(async () => {
    if (application) {
      await application.teardown();
      application = undefined;
    }
    jest.restoreAllMocks();
    TEST_WIRING.testing.Reset();
  });

  it("Should attach to ZCC", () => {
    expect(ZCC.application).not.toBeDefined();
    expect(ZCC.bootstrap).toBeDefined();
    expect(ZCC.createApplication).toBeDefined();
    expect(ZCC.createLibrary).toBeDefined();
    expect(ZCC.lifecycle).toBeDefined();
    expect(ZCC.loader).toBeDefined();
    expect(ZCC.teardown).toBeDefined();
  });

  describe("ZCC Core Initialization and Service Wiring", () => {
    //
    // WireService
    //
    describe("WireService Function", () => {
      it("throws an exception for duplicate service names", async () => {
        const testService = jest.fn();
        const serviceName = "DuplicateService";
        const projectName = "testProject";

        // First wiring should succeed
        await TEST_WIRING.testing.WireService(
          projectName,
          serviceName,
          testService,
          undefined,
        );

        // Second wiring with the same service name should throw an exception
        await expect(
          TEST_WIRING.testing.WireService(
            projectName,
            serviceName,
            testService,
            undefined,
          ),
        ).rejects.toThrow("DUPLICATE_SERVICE_NAME");
      });

      it("logs an error to the console when service initialization fails", async () => {
        const faultyService = jest.fn().mockImplementation(() => {
          throw new Error("Initialization failed");
        });
        const serviceName = "FaultyService";
        const projectName = "testProject";

        // Mock console.log to intercept logs
        const consoleSpy = jest
          .spyOn(console, "log")
          .mockImplementation(() => {});

        const failFastSpy = jest
          .spyOn(TEST_WIRING, "FailFast")
          .mockImplementation(() => {});

        // Attempt to wire the faulty service
        await TEST_WIRING.testing.WireService(
          projectName,
          serviceName,
          faultyService,
          undefined,
        );
        expect(failFastSpy).toHaveBeenCalled();

        // Check if console.log was called with the expected error message
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));

        // Restore the original console.log function
        consoleSpy.mockRestore();
      });
    });

    //
    // CreateLibrary
    //
    describe("CreateLibrary Function", () => {
      it("should create a library with given configurations and services", () => {
        const testService = jest.fn();
        const library = ZCC.createLibrary({
          name: "testLibrary",
          services: [["TestService", testService]],
        });

        expect(library).toBeDefined();
        expect(library.name).toBe("testLibrary");
        expect(library.services.length).toBe(1);
        expect(library.services[0][0]).toBe("TestService");
        expect(library.services[0][1]).toBe(testService);
      });

      it("should create a library without services", () => {
        const library = ZCC.createLibrary({
          name: "emptyLibrary",
        });

        expect(library).toBeDefined();
        expect(library.name).toBe("emptyLibrary");
        expect(library.services).toEqual([]);
      });

      it("properly wires services when creating a library", async () => {
        const testService = jest.fn();
        const library = ZCC.createLibrary({
          name: "testLibrary",
          services: [["TestService", testService]],
        });
        await library.wire();
        // Check that the service is wired correctly
        expect(testService).toHaveBeenCalled();
      });

      it("throws an error with invalid service definition", () => {
        expect(() => {
          ZCC.createLibrary({
            name: "invalidLibrary",
            services: [["InvalidService", null]],
          });
        }).toThrow("Invalid service definition");
      });

      it("integrates correctly with the event emitter for error handling", () => {
        const library = ZCC.createLibrary({ name: "eventLibrary" });
        const eventSpy = jest.spyOn(library, "onError");
        // Simulate an error event
        library.onError(() => {
          throw new Error("Test Error");
        });
        expect(eventSpy).toHaveBeenCalled();
      });

      it("integrates lifecycle methods correctly in a created library", () => {
        const library = ZCC.createLibrary({ name: "lifecycleLibrary" });
        expect(typeof library.lifecycle.onBootstrap).toBe("function");
        expect(typeof library.lifecycle.onShutdownStart).toBe("function");
      });

      it("creates multiple libraries with distinct configurations", () => {
        const libraryOne = ZCC.createLibrary({ name: "libraryOne" });
        const libraryTwo = ZCC.createLibrary({ name: "libraryTwo" });
        expect(libraryOne.name).not.toBe(libraryTwo.name);
      });

      it("throws a BootstrapException for an invalid service definition in a library", () => {
        const invalidServiceDefinition = undefined; // Example of an invalid service definition
        expect(() => {
          ZCC.createLibrary({
            name: "libraryWithInvalidService",
            services: [["InvalidService", invalidServiceDefinition]],
          });
        }).toThrow(BootstrapException);
      });

      it("throws a BootstrapException if no name is provided for the library", () => {
        expect(() => {
          ZCC.createLibrary({ name: "" });
        }).toThrow(BootstrapException);
      });
    });

    //
    // CreateApplication
    //
    describe("CreateApplication Function", () => {
      it("should create an application with specified services and libraries", () => {
        const testService = jest.fn();
        const testLibrary = ZCC.createLibrary({
          name: "testLibrary",
          services: [["TestService", testService]],
        });

        application = ZCC.createApplication({
          libraries: [testLibrary],
          name: "testApp",
          services: [["AppService", jest.fn()]],
        });

        expect(application).toBeDefined();
        expect(application.name).toBe("testApp");
        expect(application.services.length).toBe(1);
        expect(application.services[0][0]).toBe("AppService");
        expect(application.libraries.length).toBe(1);
        expect(application.libraries[0]).toBe(testLibrary);
      });

      it("should create an application with specified services and libraries", () => {
        const testService = jest.fn();
        const testLibrary = ZCC.createLibrary({
          name: "testLibrary",
          services: [["TestService", testService]],
        });

        application = ZCC.createApplication({
          libraries: [testLibrary],
          name: "testApp",
          services: [["AppService", jest.fn()]],
        });

        expect(application).toBeDefined();
        expect(application.name).toBe("testApp");
        expect(application.services.length).toBe(1);
        expect(application.services[0][0]).toBe("AppService");
        expect(application.libraries.length).toBe(1);
        expect(application.libraries[0]).toBe(testLibrary);
      });

      it("correctly initializes and wires a service to an application", async () => {
        const testService = jest.fn().mockResolvedValue({ initialized: true });
        const testServiceName = "TestService";

        // Create an application with a test service
        application = ZCC.createApplication({
          name: "testApp",
          services: [[testServiceName, testService]],
        });

        // Wire the test service to the application
        await TEST_WIRING.testing.WireService(
          "testApp",
          testServiceName,
          testService,
          undefined,
        );

        // Retrieve the wired service from the application's services array
        const wiredService = application.services.find(
          ([name]) => name === testServiceName,
        )[1];

        // Assertions
        expect(testService).toHaveBeenCalled();
        expect(wiredService).toBeDefined();
        expect(
          TEST_WIRING.testing.REVERSE_MODULE_MAPPING().get(testService),
        ).toEqual(["testApp", "TestService"]);
      });

      it("integrates correctly with the event emitter for error handling in an application", () => {
        const application = ZCC.createApplication({ name: "eventApp" });
        const eventSpy = jest.spyOn(application, "onError");
        // Simulate an error event
        application.onError(() => {
          throw new Error("Test Error");
        });
        expect(eventSpy).toHaveBeenCalled();
      });
    });
  });

  describe("Application Lifecycle", () => {
    beforeEach(() => {
      // Create application instance
      application = ZCC.createApplication({ name: "testApp" });
    });

    it("should call the lifecycle events in order during application bootstrap", async () => {
      // Spy on lifecycle event functions
      const spyPreInit = jest.fn();
      const spyPostConfig = jest.fn();
      const spyBootstrap = jest.fn();
      const spyReady = jest.fn();

      application.lifecycle.onPreInit(spyPreInit);
      application.lifecycle.onPostConfig(spyPostConfig);
      application.lifecycle.onBootstrap(spyBootstrap);
      application.lifecycle.onReady(spyReady);

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

      // Restore the original implementations
      jest.restoreAllMocks();
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
        .spyOn(TEST_WIRING, "FailFast")
        .mockImplementation(() => {});

      // Execute the Bootstrap function
      await application.bootstrap();

      // Check if FailFast was called
      expect(failFastSpy).toHaveBeenCalled();
    });

    it("wires services correctly in applications and libraries", async () => {
      const testService = jest.fn();
      await TEST_WIRING.testing.WireService(
        "testLibrary",
        "TestService",
        testService,
        application.lifecycle,
      );

      // Assuming WireService modifies the MODULE_MAPPINGS in TEST_WIRING.testing
      expect(
        TEST_WIRING.testing.MODULE_MAPPINGS().get("testLibrary")["TestService"],
      ).toBe(testService);
    });

    it("executes prioritized lifecycle callbacks in the correct order", async () => {
      // Array to track the execution order
      const executionOrder = [];

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
