import type {
  ApplicationDefinition,
  BootstrapOptions,
  InternalDefinition,
  LifecycleStages,
  OptionalModuleConfiguration,
  RollupMember,
  ServiceMap,
} from "../src/index.mts";
import {
  BootstrapException,
  buildSortOrder,
  CreateApplication,
  CreateLibrary,
  createMockLogger,
  createModule,
  flattenLibraries,
  is,
  isRollup,
  LibraryGroup,
  ServiceRunner,
  sleep,
  TestRunner,
  wireOrder,
} from "../src/index.mts";

export const FAKE_EXIT = (() => {}) as () => never;

const BASIC_BOOT = {
  configuration: { boilerplate: { LOG_LEVEL: "silent" } },
} as BootstrapOptions;

let application: ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>;

afterEach(async () => {
  if (application) {
    await application.teardown();
    application = undefined;
  }
  vi.restoreAllMocks();
});

// #MARK: ServiceRunner
describe("ServiceRunner", () => {
  it("exists", () => {
    expect(ServiceRunner).toBeDefined();
  });

  it("runs a service", async () => {
    expect.assertions(1);
    await ServiceRunner({}, function ({ context }) {
      expect(context).toBeDefined();
    });
  });

  it("uses dynamic as default name", async () => {
    expect.assertions(1);
    await ServiceRunner({}, function (params) {
      expect("dynamic" in params).toBe(true);
    });
  });

  it("uses provided name", async () => {
    expect.assertions(1);
    await ServiceRunner({ name: "foo" }, function (params) {
      expect("foo" in params).toBe(true);
    });
  });

  it("maps configs", async () => {
    expect.assertions(1);
    await ServiceRunner(
      {
        configuration: {
          FOO: {
            default: false,
            type: "boolean",
          },
        },
      },
      function ({ config }) {
        expect(config.dynamic.FOO).toBe(false);
      },
    );
  });

  it("runs lifecycle events by default", async () => {
    expect.assertions(1);
    await ServiceRunner({}, function ({ internal }) {
      expect(is.empty(internal.boot.completedLifecycleEvents)).toBe(true);
    });
  });

  it("passes through bootstrap options", async () => {
    expect.assertions(1);
    await ServiceRunner({ bootstrap: { bootLibrariesFirst: true } }, function ({ internal }) {
      expect(is.empty(internal.boot.completedLifecycleEvents)).toBe(false);
    });
  });
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
    try {
      CreateLibrary({
        // @ts-expect-error For unit testing
        name: "testing",
        services: { InvalidService: undefined },
      });
    } catch (error) {
      expect(error.cause).toBe("INVALID_SERVICE_DEFINITION");
    }
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
      expect(error.cause).toBe("DOUBLE_BOOT");
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
    expect.assertions(2);
    const errorMock = vi.fn(() => {
      throw new Error("EXPECTED_UNIT_TESTING_ERROR");
    });

    await expect(
      TestRunner().run(({ lifecycle }) => {
        lifecycle.onBootstrap(errorMock);
      }),
    ).rejects.toThrow("EXPECTED_UNIT_TESTING_ERROR");

    expect(errorMock).toHaveBeenCalled();
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
    expect.assertions(4);
    const app = CreateApplication({
      // @ts-expect-error testing
      name: "app",
      services: {},
    });
    await app.bootstrap({
      configSources: { argv: false, env: false },
      customLogger: mockLogger,
      showExtraBootStats: true,
    });
    expect(spy).toHaveBeenCalledWith(
      "boilerplate:wiring",
      expect.objectContaining({
        Bootstrap: expect.any(String),
        Configure: expect.any(String),
        Construct: expect.objectContaining({
          boilerplate: expect.any(String),
          services: expect.arrayContaining([
            expect.objectContaining({
              duration: expect.stringMatching(/^\d+\.\d{2}ms$/),
              module: expect.any(String),
              service: expect.any(String),
            }),
          ]),
        }),
        PostConfig: expect.any(String),
        PreInit: expect.any(String),
        Ready: expect.any(String),
        Total: expect.any(String),
        config: {},
        name: expect.any(Function),
      }),
      "[%s] application bootstrapped",
      "app",
    );
    // Verify services array structure
    const callArgs = spy.mock.calls.find(call => call[2] === "[%s] application bootstrapped");
    expect(callArgs).toBeDefined();
    const stats = callArgs[1] as unknown as {
      Construct: { services: Array<{ duration: string; module: string; service: string }> };
    };
    expect(stats.Construct.services.length).toBeGreaterThan(0);
    expect(stats.Construct.services[0]).toMatchObject({
      duration: expect.stringMatching(/^\d+\.\d{2}ms$/),
      module: expect.any(String),
      service: expect.any(String),
    });
  });

  it("tracks service construction times in order", async () => {
    const mockLogger = createMockLogger();
    const spy = vi.spyOn(mockLogger, "info");
    expect.assertions(4);
    const app = CreateApplication({
      // @ts-expect-error testing
      name: "app",
      services: {
        ServiceA() {
          // no-op
        },
        ServiceB() {
          // no-op
        },
      },
    });
    await app.bootstrap({
      customLogger: mockLogger,
      showExtraBootStats: true,
    });
    const callArgs = spy.mock.calls.find(call => call[2] === "[%s] application bootstrapped");
    expect(callArgs).toBeDefined();
    const stats = callArgs[1] as unknown as {
      Construct: { services: Array<{ duration: string; module: string; service: string }> };
    };
    const appServices = stats.Construct.services.filter(s => s.module === "app");
    expect(appServices.length).toBeGreaterThanOrEqual(2);
    const serviceNames = appServices.map(s => s.service);
    expect(serviceNames).toContain("ServiceA");
    expect(serviceNames).toContain("ServiceB");
  });

  it("tracks config loader timings including file loader", async () => {
    const mockLogger = createMockLogger();
    const spy = vi.spyOn(mockLogger, "info");
    expect.assertions(3);
    const app = CreateApplication({
      // @ts-expect-error testing
      name: "app",
      services: {},
    });
    await app.bootstrap({
      configSources: { file: true },
      customLogger: mockLogger,
      showExtraBootStats: true,
    });
    const callArgs = spy.mock.calls.find(call => call[2] === "[%s] application bootstrapped");
    expect(callArgs).toBeDefined();
    const stats = callArgs[1] as unknown as { config: Record<string, string> };
    expect(stats.config).toBeDefined();
    expect(stats.config).toMatchObject({
      file: expect.stringMatching(/^\d+\.\d{2}ms$/),
    });
  });

  it("tracks custom config loader timings", async () => {
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
      showExtraBootStats: true,
    });
    const callArgs = spy.mock.calls.find(call => call[2] === "[%s] application bootstrapped");
    expect(callArgs).toBeDefined();
    const stats = callArgs[1] as unknown as { config: Record<string, string> };
    // Verify config structure exists (custom loaders would be tracked if registered)
    expect(stats.config).toBeDefined();
  });

  it("does not run custom loader when explicitly disabled", async () => {
    const loaderSpy = vi.fn().mockResolvedValue({});
    expect.assertions(1);
    await TestRunner()
      // @ts-expect-error testing
      .setOptions({ configSources: { custom: false } })
      .run(({ lifecycle, internal }) => {
        // @ts-expect-error testing
        internal.config.registerLoader(loaderSpy, "custom");
        lifecycle.onPostConfig(() => {
          expect(loaderSpy).not.toHaveBeenCalled();
        });
      });
  });

  it("tracks custom loader timings when enabled", async () => {
    const loaderSpy = vi.fn().mockResolvedValue({});
    expect.assertions(2);
    await TestRunner()
      .setOptions({
        configSources: {
          argv: false,
          env: false,
          file: false,
        },
      })
      .run(({ lifecycle, internal }) => {
        // @ts-expect-error testing
        internal.config.registerLoader(loaderSpy, "custom");
        lifecycle.onReady(() => {
          expect(loaderSpy).toHaveBeenCalled();
          expect(internal.boot.configTimings.custom).toMatch(/^\d+\.\d{2}ms$/);
        });
      });
  });

  it("tracks argv and env timings when configs are processed", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test-value";
    expect.assertions(1);
    await TestRunner()
      .emitLogs()
      .setOptions({
        configSources: {
          argv: false,
          env: true,
          file: false,
        },
      })
      .run(({ lifecycle, internal }) => {
        lifecycle.onReady(() => {
          expect(internal.boot.configTimings.env).toMatch(/^\d+\.\d{2}ms$/);
        });
      });
    process.env.NODE_ENV = originalEnv;
  });

  it("does not log extended boot stats by default", async () => {
    const mockLogger = createMockLogger();
    const spy = vi.spyOn(mockLogger, "info");
    expect.assertions(5);
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
    const callArgs = spy.mock.calls.find(call => call[2] === "[%s] application bootstrapped");
    expect(callArgs).toBeDefined();
    const stats = callArgs[1] as unknown as Record<string, unknown>;
    expect(stats.Construct).toBeUndefined();
    expect(stats.config).toBeUndefined();
  });

  it("throws errors with missing priority services in apps", async () => {
    expect.assertions(1);
    try {
      CreateApplication({
        // @ts-expect-error testing
        name: "library",
        // @ts-expect-error testing
        priorityInit: ["missing"],
        services: {},
      });
    } catch (error) {
      expect(error.cause).toBe("MISSING_PRIORITY_SERVICE");
    }
  });

  it("throws errors with missing priority libraries", async () => {
    expect.assertions(1);
    try {
      CreateLibrary({
        // @ts-expect-error testing
        name: "library",
        // @ts-expect-error testing
        priorityInit: ["missing"],
        services: {},
      });
    } catch (error) {
      expect(error.cause).toBe("MISSING_PRIORITY_SERVICE");
    }
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

  it("calls fatalLog and process.exit in bootstrap app-mode catch (no customLogger)", async () => {
    expect.assertions(1);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(FAKE_EXIT);

    application = CreateApplication({
      configurationLoaders: [],
      libraries: [
        CreateLibrary({
          configuration: {
            REQUIRED_KEY: { required: true, type: "string" },
          },
          // @ts-expect-error testing
          name: "needs_config",
          services: {},
        }),
      ],
      // @ts-expect-error testing
      name: "testing",
      services: {},
    });

    // LOG_LEVEL is not "silent" here so fatalLog fires before process.exit
    await application.bootstrap({
      configuration: { boilerplate: { LOG_LEVEL: "error" } },
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

// #MARK: Boot Phase
describe("Boot Phase", () => {
  it("should exit if service constructor throws error", async () => {
    expect.assertions(1);

    await expect(
      TestRunner().run(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("preserves error class through wireService customLogger re-throw", async () => {
    expect.assertions(1);
    class ServiceInitError extends Error {}

    await expect(
      TestRunner().run(() => {
        throw new ServiceInitError("custom class");
      }),
    ).rejects.toThrow(ServiceInitError);
  });

  it("calls process.exit in wireService app-mode catch (no customLogger)", async () => {
    expect.assertions(1);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(FAKE_EXIT);

    application = CreateApplication({
      configurationLoaders: [],
      // @ts-expect-error testing
      name: "testing",
      services: {
        Broken() {
          throw new Error("app-mode constructor failure");
        },
      },
    });

    await application.bootstrap(BASIC_BOOT);
    expect(exitSpy).toHaveBeenCalledWith(1);
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
    expect.assertions(3);
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const spy = vi.fn();
    await TestRunner().run(({ lifecycle }) => {
      lifecycle.onPreShutdown(spy);
    });
    process.emit("SIGTERM");
    await new Promise<void>(done => setTimeout(done, 10));

    expect(spy).toHaveBeenCalled();
    expect(exit).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(143); // SIGTERM
    application = undefined;
  });

  it("should shutdown on SIGINT", async () => {
    expect.assertions(3);
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const spy = vi.fn();

    await TestRunner().run(({ lifecycle }) => {
      lifecycle.onPreShutdown(spy);
    });
    process.emit("SIGINT");
    await new Promise<void>(done => setTimeout(done, 10));

    expect(spy).toHaveBeenCalled();
    expect(exit).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(130); // SIGINT
    application = undefined;
  });
});

// #MARK: Hot reload re-entry
describe("Hot reload re-entry", () => {
  // `bun --hot` re-evaluates the entry in the SAME process with no SIGINT/SIGTERM
  // and no new process — it just re-runs CreateApplication + bootstrap for the
  // same app name. The prior instance (server port, sockets, timers, signal
  // listeners) must be torn down on the new boot or it leaks until a resource
  // ceiling kills further boots. https://github.com/Digital-Alchemy-TS/core/issues/89
  it("tears down a prior same-name application when re-bootstrapped", async () => {
    expect.assertions(2);
    const firstShutdown = vi.fn();

    const first = CreateApplication({
      configurationLoaders: [],
      // @ts-expect-error testing
      name: "hot_reload",
      services: {
        Test({ lifecycle }) {
          lifecycle.onShutdownStart(firstShutdown);
        },
      },
    });
    await first.bootstrap(BASIC_BOOT);

    // second generation of the same app, exactly as a hot reload would produce
    application = CreateApplication({
      configurationLoaders: [],
      // @ts-expect-error testing
      name: "hot_reload",
      services: { Test() {} },
    });
    await application.bootstrap(BASIC_BOOT);

    expect(firstShutdown).toHaveBeenCalledTimes(1);
    expect(first.booted).toBe(false);
  });

  it("does not accumulate SIGINT/SIGTERM listeners across re-bootstraps", async () => {
    expect.assertions(2);
    const sigtermBefore = process.listenerCount("SIGTERM");
    const sigintBefore = process.listenerCount("SIGINT");

    const first = CreateApplication({
      configurationLoaders: [],
      // @ts-expect-error testing
      name: "hot_reload_listeners",
      services: { Test() {} },
    });
    await first.bootstrap(BASIC_BOOT);

    application = CreateApplication({
      configurationLoaders: [],
      // @ts-expect-error testing
      name: "hot_reload_listeners",
      services: { Test() {} },
    });
    await application.bootstrap(BASIC_BOOT);

    // a single set of handlers serves the whole process regardless of reloads
    expect(process.listenerCount("SIGTERM")).toBeLessThanOrEqual(sigtermBefore + 1);
    expect(process.listenerCount("SIGINT")).toBeLessThanOrEqual(sigintBefore + 1);
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

  it("crashes when two libraries share a name", () => {
    const dupeA = CreateLibrary({ name: "dupe", services: { One() {} } });
    const dupeB = CreateLibrary({ name: "dupe", services: { Two() {} } });
    expect(() =>
      CreateApplication({
        libraries: [dupeA, dupeB],
        // @ts-expect-error testing
        name: "testing",
        services: {},
      }),
    ).toThrow(BootstrapException);
  });

  it("crashes when the same library object is listed twice", () => {
    const dupe = CreateLibrary({ name: "dupe", services: { One() {} } });
    expect(() =>
      CreateApplication({
        libraries: [dupe, dupe],
        // @ts-expect-error testing
        name: "testing",
        services: {},
      }),
    ).toThrow(BootstrapException);
  });

  it("reports every duplicated name in one error", () => {
    const mk = (name: string) => CreateLibrary({ name, services: {} });
    let caught: BootstrapException;
    try {
      CreateApplication({
        libraries: [mk("a"), mk("a"), mk("b"), mk("b")],
        // @ts-expect-error testing
        name: "testing",
        services: {},
      });
    } catch (error) {
      caught = error as BootstrapException;
    }
    expect(caught.cause).toBe("DUPLICATE_LIBRARY");
    expect(caught.message).toContain('"a"');
    expect(caught.message).toContain('"b"');
  });

  it.each(["logger", "config", "internal", "boilerplate", "scheduler"])(
    "rejects a library named after the reserved builtin %s",
    reserved => {
      let caught: BootstrapException;
      try {
        CreateApplication({
          // @ts-expect-error testing
          libraries: [CreateLibrary({ name: reserved, services: {} })],
          name: "testing",
          services: {},
        });
      } catch (error) {
        caught = error as BootstrapException;
      }
      expect(caught.cause).toBe("RESERVED_LIBRARY_NAME");
      expect(caught.message).toMatch(/reserved/i);
    },
  );

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

  it("auto-pulls transitive deps via closure-as-membership (no missing-dep error)", async () => {
    // LIBRARY_C depends on [A, B]; LIBRARY_B depends on [A].
    // Listing only LIBRARY_C pulls A and B in automatically — no error.
    application = CreateApplication({
      configurationLoaders: [],
      libraries: [LIBRARY_C],
      // @ts-expect-error testing
      name: "testing",
      services: {},
    });
    const failFastSpy = vi.spyOn(process, "exit").mockImplementation(FAKE_EXIT);
    expect.assertions(1);
    await application.bootstrap(BASIC_BOOT);
    expect(failFastSpy).not.toHaveBeenCalled();
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

  it("library substitution via appendLibrary replaces the auto-pulled original", async () => {
    // With closure-as-membership, listing LIBRARY_C auto-pulls the original LIBRARY_A.
    // To substitute, use appendLibrary — it replaces the same-named entry.
    const customA = CreateLibrary({
      // @ts-expect-error testing
      name: "A",
      services: {
        AddToList: () => list.push("A"),
      },
    });
    application = CreateApplication({
      configurationLoaders: [],
      libraries: [LIBRARY_C],
      // @ts-expect-error testing
      name: "testing",
      services: {},
    });
    const failFastSpy = vi.spyOn(process, "exit").mockImplementation(FAKE_EXIT);
    await application.bootstrap({
      ...BASIC_BOOT,
      appendLibrary: customA,
    });
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

// #MARK: Library composition (rollups)
describe("Library composition", () => {
  let list: string[];

  // named test libraries; ordering edges only via `depends`
  const LIB_BASE = CreateLibrary({
    // @ts-expect-error test library name not in LoadedModules
    name: "rollup_base",
    services: { Add: () => list.push("base") },
  });
  const LIB_ONE = CreateLibrary({
    depends: [LIB_BASE],
    // @ts-expect-error test library name not in LoadedModules
    name: "rollup_one",
    services: { Add: () => list.push("one") },
  });
  const LIB_TWO = CreateLibrary({
    // @ts-expect-error test library name not in LoadedModules
    name: "rollup_two",
    services: { Add: () => list.push("two") },
  });
  const LIB_THREE = CreateLibrary({
    // @ts-expect-error test library name not in LoadedModules
    name: "rollup_three",
    services: { Add: () => list.push("three") },
  });

  beforeEach(() => {
    list = [];
  });

  describe("LibraryGroup + flattenLibraries", () => {
    it("brands a group; isRollup distinguishes it from a library", () => {
      const group = LibraryGroup({ members: [LIB_ONE, LIB_TWO], name: "group" });
      expect(isRollup(group)).toBe(true);
      expect(isRollup(LIB_ONE)).toBe(false);
      expect(group.name).toBe("group");
      expect(group.members).toHaveLength(2);
    });

    it("flattens a group to its members plus transitive depends (closure-as-membership)", () => {
      // LIB_ONE depends on LIB_BASE — closure-as-membership pulls LIB_BASE in automatically
      const { libraries } = flattenLibraries([LibraryGroup({ members: [LIB_ONE, LIB_TWO] })]);
      expect(libraries.map(index => index.name)).toEqual(["rollup_base", "rollup_one", "rollup_two"]);
    });

    it("flattens nested groups transitively, including transitive depends", () => {
      const inner = LibraryGroup({ members: [LIB_TWO, LIB_THREE] });
      const outer = LibraryGroup({ members: [LIB_ONE, inner] });
      const { libraries } = flattenLibraries([outer]);
      // LIB_ONE depends on LIB_BASE → closure pulls LIB_BASE in first
      expect(libraries.map(index => index.name)).toEqual([
        "rollup_base",
        "rollup_one",
        "rollup_two",
        "rollup_three",
      ]);
    });

    it("dedupes a shared member reached through two groups (diamond)", () => {
      const a = LibraryGroup({ members: [LIB_BASE, LIB_ONE] });
      const b = LibraryGroup({ members: [LIB_BASE, LIB_TWO] });
      const { libraries, provenance } = flattenLibraries([a, b]);
      expect(libraries.filter(index => index.name === "rollup_base")).toHaveLength(1);
      expect(provenance.multiPath).toContain("rollup_base");
    });

    it("dedupes a member listed directly and via a group", () => {
      const { libraries } = flattenLibraries([LIB_ONE, LibraryGroup({ members: [LIB_ONE, LIB_TWO] })]);
      expect(libraries.filter(index => index.name === "rollup_one")).toHaveLength(1);
    });

    it("closure-as-membership: listing a lib and its dep both works; dep appears first", () => {
      // LIB_BASE + LIB_ONE (depends on LIB_BASE) — LIB_BASE enters via two paths but deduped
      const { libraries } = flattenLibraries([LIB_BASE, LIB_ONE]);
      expect(libraries.map(index => index.name)).toEqual(["rollup_base", "rollup_one"]);
    });

    it("throws COMPOSITION_CYCLE on a nested-group cycle", () => {
      const a = LibraryGroup({ members: [LIB_ONE], name: "a" });
      const b = LibraryGroup({ members: [a], name: "b" });
      // force a cycle (the public API alone can't build one): a -> b -> a
      (a.members as RollupMember[]).push(b);
      let caught: BootstrapException;
      try {
        flattenLibraries([a]);
      } catch (error) {
        caught = error as BootstrapException;
      }
      expect(caught?.cause).toBe("COMPOSITION_CYCLE");
    });
  });

  describe("groups at bootstrap", () => {
    it("wires every member of a group listed in libraries", async () => {
      application = CreateApplication({
        libraries: [LibraryGroup({ members: [LIB_BASE, LIB_TWO] })],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);
      expect(list).toEqual(expect.arrayContaining(["base", "two"]));
    });

    it("orders a member's depends correctly when membership came via a group", async () => {
      // LIB_ONE depends on LIB_BASE; both arrive only through the group
      application = CreateApplication({
        libraries: [LibraryGroup({ members: [LIB_ONE, LIB_BASE] })],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);
      expect(list.indexOf("base")).toBeLessThan(list.indexOf("one"));
    });

    it("does not throw at CreateApplication time when a group is present", () => {
      expect(() =>
        CreateApplication({
          libraries: [LibraryGroup({ members: [LIB_ONE, LIB_TWO] })],
          // @ts-expect-error test app name not in LoadedModules
          name: "testing",
          services: {},
        }),
      ).not.toThrow();
    });

    it("rejects same-name/different-object delivered via a group (DUPLICATE_LIBRARY)", async () => {
      const dupe = CreateLibrary({
        // @ts-expect-error test library name not in LoadedModules
        name: "rollup_one",
        services: { Add: () => list.push("dupe") },
      });
      application = CreateApplication({
        libraries: [LIB_ONE, LibraryGroup({ members: [dupe] })],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      const failFast = vi.spyOn(process, "exit").mockImplementation(FAKE_EXIT);
      await application.bootstrap(BASIC_BOOT);
      expect(failFast).toHaveBeenCalled();
    });

    it("warns when a library enters membership via multiple paths", async () => {
      const customLogger = createMockLogger();
      const warn = vi.spyOn(customLogger, "warn");
      application = CreateApplication({
        libraries: [LibraryGroup({ members: [LIB_BASE, LIB_ONE] }), LibraryGroup({ members: [LIB_BASE, LIB_TWO] })],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap({ customLogger });
      const warnCall = warn.mock.calls.find(
        call => typeof call[2] === "string" && call[2].includes("multiple composition paths"),
      );
      expect(warnCall).toBeDefined();
      expect(warnCall?.[1]).toMatchObject({ members: expect.arrayContaining(["rollup_base"]) });
    });

    it("includes group provenance in the boot manifest", async () => {
      const customLogger = createMockLogger();
      const info = vi.spyOn(customLogger, "info");
      application = CreateApplication({
        libraries: [LibraryGroup({ members: [LIB_TWO], name: "grp" })],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap({ customLogger, showExtraBootStats: true });
      const manifestCall = info.mock.calls.find(call => call[2] === "[%s] application bootstrapped");
      expect(manifestCall).toBeDefined();
      const stats = manifestCall?.[1] as { rollups?: Record<string, unknown> };
      expect(stats.rollups).toHaveProperty("rollup_two");
    });

    it("warns when listing a dep and its dependent (closure creates multi-path for the dep)", async () => {
      // LIB_ONE.depends = [LIB_BASE]; listing both means LIB_BASE reaches membership via two paths.
      // The warning is the honest signal that the direct LIB_BASE listing is redundant.
      const customLogger = createMockLogger();
      const warn = vi.spyOn(customLogger, "warn");
      application = CreateApplication({
        libraries: [LIB_BASE, LIB_ONE],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap({ customLogger });
      const warnCall = warn.mock.calls.find(
        call => typeof call[2] === "string" && call[2].includes("multiple composition paths"),
      );
      expect(warnCall).toBeDefined();
      expect(warnCall?.[1]).toMatchObject({ members: expect.arrayContaining(["rollup_base"]) });
    });

    it("narrates an auto-pulled dependency in the boot log naming its puller", async () => {
      // Listing only LIB_ONE auto-pulls LIB_BASE via closure (LIB_ONE depends on LIB_BASE).
      // The boot log must announce LIB_BASE as auto-pulled, named by its puller LIB_ONE.
      const customLogger = createMockLogger();
      const info = vi.spyOn(customLogger, "info");
      application = CreateApplication({
        libraries: [LIB_ONE],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap({ customLogger });
      const narration = info.mock.calls.find(
        call => typeof call[2] === "string" && call[2].includes("auto-pulled into membership"),
      );
      expect(narration).toBeDefined();
      // message args: (name, puller) → LIB_BASE pulled by LIB_ONE
      expect(narration?.[3]).toBe("rollup_base");
      expect(narration?.[4]).toBe("rollup_one");
      expect(narration?.[1]).toMatchObject({ puller: "rollup_one" });
    });

    it("surfaces auto-pulled provenance in the boot manifest for introspection", async () => {
      const customLogger = createMockLogger();
      const info = vi.spyOn(customLogger, "info");
      application = CreateApplication({
        libraries: [LIB_ONE],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap({ customLogger, showExtraBootStats: true });
      const manifestCall = info.mock.calls.find(call => call[2] === "[%s] application bootstrapped");
      const stats = manifestCall?.[1] as { rollups?: { autoPulled?: Record<string, string> } };
      expect(stats.rollups?.autoPulled).toMatchObject({ rollup_base: "rollup_one" });
    });

    it("does not warn when listing only the top-level lib (dep auto-pulled)", async () => {
      // Only LIB_ONE listed; LIB_BASE auto-pulled via closure — single path, no warning
      const customLogger = createMockLogger();
      const warn = vi.spyOn(customLogger, "warn");
      application = CreateApplication({
        libraries: [LIB_ONE],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap({ customLogger });
      const warnCall = warn.mock.calls.find(
        call => typeof call[2] === "string" && call[2].includes("multiple composition paths"),
      );
      expect(warnCall).toBeUndefined();
    });
  });

  describe("implies", () => {
    it("contributes the implied bundle to membership", () => {
      const implied = CreateLibrary({
        // @ts-expect-error test library name not in LoadedModules
        name: "implied_member",
        services: { Add: () => list.push("implied") },
      });
      const implier = CreateLibrary({
        implies: [implied],
        // @ts-expect-error test library name not in LoadedModules
        name: "implier",
        services: { Add: () => list.push("implier") },
      });
      const { libraries } = flattenLibraries([implier]);
      expect(libraries.map(index => index.name)).toEqual(["implier", "implied_member"]);
    });

    it("dedupes an implied member also listed directly", () => {
      const implied = CreateLibrary({
        // @ts-expect-error test library name not in LoadedModules
        name: "implied_member",
        services: {},
      });
      const implier = CreateLibrary({
        implies: [implied],
        // @ts-expect-error test library name not in LoadedModules
        name: "implier",
        services: {},
      });
      const { libraries } = flattenLibraries([implier, implied]);
      expect(libraries.filter(index => index.name === "implied_member")).toHaveLength(1);
    });

    it("flattens a group used inside implies (includes transitive depends)", () => {
      // LIB_ONE depends on LIB_BASE, so closure pulls LIB_BASE in too
      const implier = CreateLibrary({
        implies: [LibraryGroup({ members: [LIB_ONE, LIB_TWO] })],
        // @ts-expect-error test library name not in LoadedModules
        name: "implier",
        services: {},
      });
      const { libraries } = flattenLibraries([implier]);
      expect(libraries.map(index => index.name)).toEqual(
        expect.arrayContaining(["implier", "rollup_base", "rollup_one", "rollup_two"]),
      );
    });

    it("throws COMPOSITION_CYCLE on an implies cycle", () => {
      const aImplies: RollupMember[] = [];
      const a = CreateLibrary({
        implies: aImplies,
        // @ts-expect-error test library name not in LoadedModules
        name: "cycle_a",
        services: {},
      });
      const b = CreateLibrary({
        implies: [a],
        // @ts-expect-error test library name not in LoadedModules
        name: "cycle_b",
        services: {},
      });
      aImplies.push(b); // a implies b, b implies a
      let caught: BootstrapException;
      try {
        flattenLibraries([a]);
      } catch (error) {
        caught = error as BootstrapException;
      }
      expect(caught?.cause).toBe("COMPOSITION_CYCLE");
    });

    it("adds implied membership at bootstrap so the member wires", async () => {
      const implied = CreateLibrary({
        // @ts-expect-error test library name not in LoadedModules
        name: "implied_member",
        services: { Add: () => list.push("implied") },
      });
      const implier = CreateLibrary({
        implies: [implied],
        // @ts-expect-error test library name not in LoadedModules
        name: "implier",
        services: { Add: () => list.push("implier") },
      });
      application = CreateApplication({
        libraries: [implier],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);
      expect(list).toEqual(expect.arrayContaining(["implier", "implied"]));
    });
  });

  describe("LibraryGroup registry", () => {
    it("requires a name when registry is set", () => {
      expect(() => LibraryGroup({ members: [], registry: "plugins" })).toThrow(BootstrapException);
    });

    it("generates a working registry members register into and a consumer reads via list()", async () => {
      const collected: string[] = [];

      // two plugin members register themselves into the carrier registry at onPreInit
      const PLUGIN_A = CreateLibrary({
        // @ts-expect-error test library name not in LoadedModules
        name: "plugin_a",
        services: {
          Register({ lifecycle, host }: TServiceParams) {
            // @ts-expect-error carrier `host` not in LoadedModules
            lifecycle.onPreInit(() => host.registry.register("a"));
          },
        },
      });
      const PLUGIN_B = CreateLibrary({
        // @ts-expect-error test library name not in LoadedModules
        name: "plugin_b",
        services: {
          Register({ lifecycle, host }: TServiceParams) {
            // @ts-expect-error carrier `host` not in LoadedModules
            lifecycle.onPreInit(() => host.registry.register("b"));
          },
        },
      });

      application = CreateApplication({
        // carrier library is named "host", exposing service "registry"
        libraries: [LibraryGroup({ members: [PLUGIN_A, PLUGIN_B], name: "host", registry: "registry" })],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {
          // consumer reads the assembled list after registration (onBootstrap)
          Consumer({ lifecycle, host }: TServiceParams) {
            // @ts-expect-error carrier `host` not in LoadedModules
            lifecycle.onBootstrap(() => collected.push(...host.registry.list()));
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
      expect(collected).toEqual(expect.arrayContaining(["a", "b"]));
      expect(collected).toHaveLength(2);
    });

    it("constructs the carrier (priorityInit registry) before any member factory runs", async () => {
      // a member that reads the registry during construction proves the carrier wired first
      let registryVisibleAtMemberConstruction = false;
      const PLUGIN = CreateLibrary({
        // @ts-expect-error test library name not in LoadedModules
        name: "plugin_solo",
        services: {
          // @ts-expect-error carrier `host` not in LoadedModules
          Probe({ host }: TServiceParams) {
            registryVisibleAtMemberConstruction = typeof host?.registry?.register === "function";
          },
        },
      });
      application = CreateApplication({
        libraries: [LibraryGroup({ members: [PLUGIN], name: "host", registry: "registry" })],
        // @ts-expect-error test app name not in LoadedModules
        name: "testing",
        services: {},
      });
      await application.bootstrap(BASIC_BOOT);
      expect(registryVisibleAtMemberConstruction).toBe(true);
    });
  });
});
