import { ZCC } from "@zcc/utilities";

import { LIB_BOILERPLATE } from "../boilerplate.module.mjs";
import { BootstrapException } from "../helpers/errors.helper.mjs";
import { InitializeWiring } from "./wiring.extension.mjs";

describe("Wiring Extension", () => {
  let wiring: ReturnType<typeof InitializeWiring>;

  beforeEach(() => {
    LIB_BOILERPLATE.wire;
    wiring = InitializeWiring();
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
        await wiring.testing.WireService(
          projectName,
          serviceName,
          testService,
          undefined,
        );

        // Second wiring with the same service name should throw an exception
        await expect(
          wiring.testing.WireService(
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

        // Attempt to wire the faulty service
        await wiring.testing.WireService(
          projectName,
          serviceName,
          faultyService,
          undefined,
        );

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

        const application = ZCC.createApplication({
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

        const application = ZCC.createApplication({
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
        const testApp = ZCC.createApplication({
          name: "testApp",
          services: [[testServiceName, testService]],
        });

        // Wire the test service to the application
        await wiring.testing.WireService(
          "testApp",
          testServiceName,
          testService,
          undefined,
        );

        // Retrieve the wired service from the application's services array
        const wiredService = testApp.services.find(
          ([name]) => name === testServiceName,
        )[1];

        // Assertions
        expect(testService).toHaveBeenCalled();
        expect(wiredService).toBeDefined();
        expect(wiring.testing.REVERSE_MODULE_MAPPING.get(testService)).toEqual([
          "testApp",
          "TestService",
        ]);
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
    let application;

    beforeEach(() => {
      // Create application instance
      application = ZCC.createApplication({ name: "testApp" });
    });

    it("should call the lifecycle events in order during application bootstrap", async () => {
      // Spy on lifecycle event functions
      const spyPreInit = jest.spyOn(application.lifecycle, "onPreInit");
      const spyPostConfig = jest.spyOn(application.lifecycle, "onPostConfig");
      const spyBootstrap = jest.spyOn(application.lifecycle, "onBootstrap");
      const spyReady = jest.spyOn(application.lifecycle, "onReady");

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
  });
});
