import { env } from "process";

import {
  ApplicationDefinition,
  BootstrapOptions,
  CreateApplication,
  CreateLibrary,
  INITIALIZE,
  OptionalModuleConfiguration,
  ServiceMap,
  TServiceParams,
} from "..";

const BASIC_BOOT = {
  configuration: { boilerplate: { LOG_LEVEL: "silent" } },
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
      await application.bootstrap();
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
    beforeEach(() => {
      delete env["LOG_LEVEL"];
      delete env["log_level"];
      delete env["log-level"];
    });
    describe("Environment", () => {
      it("should resolve direct match", async () => {
        expect.assertions(1);
        application = CreateApplication({
          configuration: {
            CURRENT_WEATHER: {
              type: "string",
              default: "raining"
            }
          },
          // @ts-expect-error testing
          name: "testing",
          services: {
            Testing({ config , lifecycle}: TServiceParams) {
              lifecycle.onPostConfig(() => {

                // @ts-expect-error testing
                expect(config.library.RAINING).toBe(false);
              })
            },
          },
        });
      });
    });

    describe("CLI", () => {
      //
    });

    describe("File", () => {
      //
    });
  });
});
