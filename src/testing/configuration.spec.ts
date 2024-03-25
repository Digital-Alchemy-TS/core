import { env } from "process";

import {
  ApplicationDefinition,
  BootstrapOptions,
  ConfigLoader,
  ConfigLoaderEnvironment,
  ConfigLoaderFile,
  CreateApplication,
  CreateLibrary,
  INITIALIZE,
  OptionalModuleConfiguration,
  ServiceMap,
  TServiceParams,
} from "..";

const BASIC_BOOT = {
  configuration: { boilerplate: { LOG_LEVEL: "silent" } },
  hideLogLevel: true,
} as BootstrapOptions;

describe("Configuration", () => {
  let application: ApplicationDefinition<
    ServiceMap,
    OptionalModuleConfiguration
  >;
  let spy: jest.SpyInstance;

  afterEach(async () => {
    if (application) {
      await application.teardown();
      application = undefined;
    }
    jest.restoreAllMocks();
    spy = undefined;
  });

  describe("Initialization", () => {
    it("should be configured at the correct time in the lifecycle", async () => {
      expect.assertions(2);
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error testing
        name: "testing",
        services: {
          Testing({ internal, lifecycle }: TServiceParams) {
            spy = jest.spyOn(internal.boilerplate.configuration, INITIALIZE);
            lifecycle.onPreInit(() => {
              expect(spy).not.toHaveBeenCalled();
            });
            lifecycle.onPostConfig(() => {
              expect(spy).toHaveBeenCalled();
            });
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
    });

    it("should prioritize bootstrap config over defaults", async () => {
      expect.assertions(1);
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error testing
        name: "testing",
        services: {
          Testing({ config, lifecycle }: TServiceParams) {
            lifecycle.onPostConfig(() => {
              expect(config.boilerplate.LOG_LEVEL).toBe("silent");
            });
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
    });

    it("should have the correct defaults for boilerplate", async () => {
      expect.assertions(6);
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error testing
        name: "testing",
        services: {
          Testing({ config, lifecycle }: TServiceParams) {
            lifecycle.onPostConfig(() => {
              expect(config.boilerplate.CACHE_PREFIX).toBe("");
              expect(config.boilerplate.CACHE_PROVIDER).toBe("memory");
              expect(config.boilerplate.CACHE_TTL).toBe(86_400);
              expect(config.boilerplate.CONFIG).toBe(undefined);
              expect(config.boilerplate.LOG_LEVEL).toBe("trace");
              expect(config.boilerplate.REDIS_URL).toBe(
                "redis://localhost:6379",
              );
            });
          },
        },
      });
      // MUST STAY EMPTY!
      await application.bootstrap({});
    });

    it("should generate the correct structure for applications", async () => {
      expect.assertions(1);
      application = CreateApplication({
        configuration: {
          FOO: {
            default: "bar",
            type: "string",
          },
        },
        configurationLoaders: [],
        // @ts-expect-error testing
        name: "testing",
        services: {
          Testing({ config }: TServiceParams) {
            // @ts-expect-error testing
            expect(config.testing.FOO).toBe("bar");
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
    });

    it("should generate the correct structure for libraries", async () => {
      expect.assertions(1);
      application = CreateApplication({
        configuration: {
          FOO: {
            default: "bar",
            type: "string",
          },
        },
        configurationLoaders: [],
        libraries: [
          CreateLibrary({
            configuration: {
              RAINING: {
                default: false,
                type: "boolean",
              },
            },
            // @ts-expect-error testing
            name: "library",
            services: {},
          }),
        ],
        // @ts-expect-error testing
        name: "testing",
        services: {
          Testing({ config }: TServiceParams) {
            // @ts-expect-error testing
            expect(config.library.RAINING).toBe(false);
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
    });
  });

  describe("Loaders", () => {
    describe("General", () => {
      afterEach(() => {
        delete env["DO_NOT_LOAD"];
      });
      it("should not find variables without loaders", async () => {
        expect.assertions(1);
        env["DO_NOT_LOAD"] = "env";
        // process.argv.push("--current_WEATHER=hail");
        application = CreateApplication({
          configuration: {
            DO_NOT_LOAD: {
              default: "unloaded",
              type: "string",
            },
          },
          configurationLoaders: [],
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.DO_NOT_LOAD).toBe("unloaded");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });
    });

    describe("Environment", () => {
      afterEach(() => {
        delete env["current_weather"];
        delete env["current_WEATHER"];
        delete env["CURRENT_WEATHER"];
      });
      it("should default properly if environment variables do not exist", async () => {
        expect.assertions(1);
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("raining");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });

      it("should do direct match by key", async () => {
        expect.assertions(1);
        env["CURRENT_WEATHER"] = "windy";
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          configurationLoaders: [ConfigLoaderEnvironment as ConfigLoader],
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("windy");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });

      it("should wrong case (all lower)", async () => {
        expect.assertions(1);
        env["current_weather"] = "sunny";
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          configurationLoaders: [ConfigLoaderEnvironment as ConfigLoader],
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("sunny");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });

      it("should wrong case (mixed)", async () => {
        expect.assertions(1);
        env["current_WEATHER"] = "hail";
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          configurationLoaders: [ConfigLoaderEnvironment as ConfigLoader],
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("hail");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });
    });

    describe("CLI Switch", () => {
      beforeEach(() => {
        process.argv = ["/path/to/node", "/path/to/main"];
      });

      it("should default properly if environment variables do not exist", async () => {
        expect.assertions(1);
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("raining");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });

      it("should do direct match by key", async () => {
        expect.assertions(1);
        process.argv.push("--CURRENT_WEATHER", "windy");
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          configurationLoaders: [ConfigLoaderEnvironment as ConfigLoader],
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("windy");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });

      it("should wrong case (all lower)", async () => {
        expect.assertions(1);
        process.argv.push("--current_weather", "sunny");
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          configurationLoaders: [ConfigLoaderEnvironment as ConfigLoader],
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("sunny");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });

      it("should wrong case (mixed)", async () => {
        expect.assertions(1);
        process.argv.push("--current_WEATHER", "hail");
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          configurationLoaders: [ConfigLoaderEnvironment as ConfigLoader],
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("hail");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });

      it("is valid with equals signs", async () => {
        expect.assertions(1);
        process.argv.push("--current_WEATHER=hail");
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          configurationLoaders: [ConfigLoaderEnvironment as ConfigLoader],
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("hail");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });
    });

    describe("File", () => {
      afterAll(() => {
        //
      });

      it("is valid with equals signs", async () => {
        expect.assertions(1);
        process.argv.push("--current_WEATHER=hail");
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              default: "raining",
              type: "string",
            },
          },
          configurationLoaders: [ConfigLoaderFile as ConfigLoader],
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config, lifecycle }: TServiceParams) {
              lifecycle.onPostConfig(() => {
                // @ts-expect-error testing
                expect(config.testing.CURRENT_WEATHER).toBe("raining");
              });
            },
          },
        });
        await application.bootstrap(BASIC_BOOT);
      });
    });
  });
});
