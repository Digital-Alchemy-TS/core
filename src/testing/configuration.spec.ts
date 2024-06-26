import { env } from "process";

import {
  ApplicationDefinition,
  ConfigLoaderEnvironment,
  ConfigLoaderFile,
  CreateApplication,
  CreateLibrary,
  INITIALIZE,
  OptionalModuleConfiguration,
  ServiceMap,
  TServiceParams,
} from "..";
import { ConfigTesting } from "./config-testing.extension";
import { BASIC_BOOT, ServiceTest } from "./testing.helper";

describe("Configuration", () => {
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

  // #region Initialization
  describe("Initialization", () => {
    it("should be configured at the correct time in the lifecycle", async () => {
      expect.assertions(2);
      await ServiceTest(({ internal, lifecycle }) => {
        const spy = jest.spyOn(internal.boilerplate.configuration, INITIALIZE);
        lifecycle.onPreInit(() => {
          expect(spy).not.toHaveBeenCalled();
        });
        lifecycle.onPostConfig(() => {
          expect(spy).toHaveBeenCalled();
        });
      });
    });

    it("should prioritize bootstrap config over defaults", async () => {
      expect.assertions(1);
      await ServiceTest(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          expect(config.boilerplate.LOG_LEVEL).toBe("silent");
        });
      });
    });

    it("should have the correct defaults for boilerplate", async () => {
      expect.assertions(6);
      // hide logs that result from lack of "silent" LOG_LEVEL
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "error").mockImplementation(() => {});
      await ServiceTest(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          expect(config.boilerplate.CACHE_PREFIX).toBe("");
          expect(config.boilerplate.CACHE_PROVIDER).toBe("memory");
          expect(config.boilerplate.CACHE_TTL).toBe(86_400);
          expect(config.boilerplate.CONFIG).toBe(undefined);
          expect(config.boilerplate.LOG_LEVEL).toBe("trace");
          expect(config.boilerplate.REDIS_URL).toBe("redis://localhost:6379");
        });
      }, {});
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
  // #endregion
  // #region Loaders
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
          configurationLoaders: [ConfigLoaderEnvironment],
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
          configurationLoaders: [ConfigLoaderEnvironment],
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
          configurationLoaders: [ConfigLoaderEnvironment],
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
          configurationLoaders: [ConfigLoaderEnvironment],
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
          configurationLoaders: [ConfigLoaderEnvironment],
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
          configurationLoaders: [ConfigLoaderEnvironment],
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
          configurationLoaders: [ConfigLoaderEnvironment],
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
      it("resolves files in the correct order", async () => {
        let testFiles: ReturnType<typeof ConfigTesting>;
        const helper = CreateApplication({
          configurationLoaders: [],
          // @ts-expect-error Testing
          name: "helper",
          services: {
            ConfigTesting,
            // @ts-expect-error Testing
            Helper({ helper }: TServiceParams) {
              testFiles = helper.ConfigTesting;
            },
          },
        });
        await helper.bootstrap(BASIC_BOOT);
        await helper.teardown();
        const keys = [...testFiles.dataMap.keys()];
        let sortedFiles = testFiles.sort(keys);

        for (const filePath of sortedFiles) {
          const expectedData = testFiles.dataMap.get(filePath).testing.string;

          application = CreateApplication({
            configuration: {
              string: {
                default: "testing default value",
                type: "string",
              },
            },
            configurationLoaders: [ConfigLoaderFile],
            // @ts-expect-error Testing
            name: "testing",
            services: {
              Test({ lifecycle, config }: TServiceParams) {
                lifecycle.onPostConfig(() => {
                  // @ts-expect-error Testing
                  expect(config.testing.string).toBe(expectedData);
                });
              },
            },
          });
          await application.bootstrap(BASIC_BOOT);
          await application.teardown();
          application = undefined;
          testFiles.unlink(filePath);
          sortedFiles = testFiles.sort([...testFiles.dataMap.keys()]);
        }
      });
    });
  });
  // #endregion
});
