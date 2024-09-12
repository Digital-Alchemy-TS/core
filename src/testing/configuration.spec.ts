import { faker } from "@faker-js/faker";
import dotenv from "dotenv";
import fs from "fs";
import { ParsedArgs } from "minimist";
import { join } from "path";
import { cwd, env } from "process";

import {
  ApplicationDefinition,
  ConfigLoaderEnvironment,
  ConfigLoaderFile,
  CreateApplication,
  CreateLibrary,
  ILogger,
  INITIALIZE,
  InternalConfig,
  InternalDefinition,
  loadDotenv,
  OptionalModuleConfiguration,
  parseConfig,
  ServiceMap,
  TServiceParams,
} from "..";
import { ConfigTesting } from "./config-testing.extension";
import { createMockLogger } from "./helpers";
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
      expect.assertions(2);
      // hide logs that result from lack of "silent" LOG_LEVEL
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "error").mockImplementation(() => {});
      await ServiceTest(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          expect(config.boilerplate.CONFIG).toBe(undefined);
          expect(config.boilerplate.LOG_LEVEL).toBe("trace");
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

    // #MARK: Environment
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

    // #MARK: CLI Switches
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
        await application.bootstrap();
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

    // #MARK: File
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

  describe("Support functions", () => {
    // #MARK: parseConfig
    describe("parseConfig", () => {
      it("string config (no enum)", () => {
        const value = faker.string.alphanumeric();
        const output = parseConfig({ type: "string" }, value);
        expect(output).toBe(value);
      });

      it("string config (with enum)", () => {
        const value = faker.string.alphanumeric();
        // no logic related to enum currently, might be future logic
        const output = parseConfig(
          { enum: ["hello", "world"], type: "string" },
          value,
        );
        expect(output).toBe(value);
      });

      it("number config", () => {
        const value = faker.string.numeric();
        const output = parseConfig({ type: "number" }, value);
        expect(output).toBe(Number(value));
      });

      it("string[] config", () => {
        const value = JSON.stringify(["hello", "world"]);
        const output = parseConfig({ type: "string[]" }, value);
        expect(output).toEqual(["hello", "world"]);
      });

      it("record config", () => {
        const value = JSON.stringify({ key: "value" });
        const output = parseConfig({ type: "record" }, value);
        expect(output).toEqual({ key: "value" });
      });

      it("internal config", () => {
        const value = JSON.stringify({ internalKey: "internalValue" });
        const output = parseConfig(
          { type: "internal" } as InternalConfig<object>,
          value,
        );
        expect(output).toEqual({ internalKey: "internalValue" });
      });

      it("boolean config (true case)", () => {
        const value = "true";
        const output = parseConfig({ type: "boolean" }, value);
        expect(output).toBe(true);
      });

      it("boolean config (false case)", () => {
        const value = "false";
        const output = parseConfig({ type: "boolean" }, value);
        expect(output).toBe(false);
      });

      it("boolean config (yes case)", () => {
        const value = "y";
        const output = parseConfig({ type: "boolean" }, value);
        expect(output).toBe(true);
      });

      it("boolean config (no case)", () => {
        const value = "n";
        const output = parseConfig({ type: "boolean" }, value);
        expect(output).toBe(false);
      });
    });

    describe("loadDotenv", () => {
      let mockInternal: InternalDefinition;
      let logger: ILogger;

      beforeEach(() => {
        mockInternal = {
          boot: {
            options: {
              envFile: "",
            },
          },
        } as InternalDefinition;
        logger = createMockLogger();
      });

      it("should load env file from CLI switch if provided", () => {
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        const config = jest
          .spyOn(dotenv, "config")
          // @ts-expect-error idc
          .mockReturnValue(() => undefined);
        const CLI_SWITCHES = {
          _: [],
          "env-file": "path/to/env-file",
        } as ParsedArgs;

        loadDotenv(mockInternal, CLI_SWITCHES, logger);

        expect(config).toHaveBeenCalledWith({
          override: true,
          path: join(cwd(), "path/to/env-file"),
        });
      });

      it("should load env file from bootstrap if CLI switch is not provided", () => {
        const config = jest
          .spyOn(dotenv, "config")
          // @ts-expect-error idc
          .mockReturnValue(() => undefined);
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        mockInternal.boot.options.envFile = "path/to/bootstrap-env-file";

        const CLI_SWITCHES = {
          _: [],
          "env-file": "",
        } as ParsedArgs;

        loadDotenv(mockInternal, CLI_SWITCHES, logger);

        expect(config).toHaveBeenCalledWith({
          override: true,
          path: join(cwd(), "path/to/bootstrap-env-file"),
        });
      });

      it("should load default .env file if no CLI switch or bootstrap envFile is provided", () => {
        mockInternal.boot.options.envFile = "";
        jest.spyOn(fs, "existsSync").mockReturnValue(true);

        const config = jest
          .spyOn(dotenv, "config")
          // @ts-expect-error idc
          .mockReturnValue(() => undefined);

        const CLI_SWITCHES = {
          _: [],
          "env-file": "",
        } as ParsedArgs;

        loadDotenv(mockInternal, CLI_SWITCHES, logger);

        expect(config).toHaveBeenCalledWith({
          override: true,
          path: join(cwd(), ".env"),
        });
      });

      it("should log a warning if the specified envFile does not exist", () => {
        mockInternal.boot.options.envFile = "nonexistent-file";

        const CLI_SWITCHES = {
          _: [],
          "env-file": "",
        } as ParsedArgs;
        jest.spyOn(fs, "existsSync").mockReturnValue(false);

        const config = jest
          .spyOn(dotenv, "config")
          // @ts-expect-error idc
          .mockReturnValue(() => undefined);

        loadDotenv(mockInternal, CLI_SWITCHES, logger);
        expect(config).not.toHaveBeenCalled();
      });

      it("should do nothing if no valid envFile or .env file exists", () => {
        mockInternal.boot.options.envFile = "";

        const CLI_SWITCHES = {
          _: [],
          "env-file": "",
        } as ParsedArgs;
        jest.spyOn(fs, "existsSync").mockReturnValue(false);

        const config = jest
          .spyOn(dotenv, "config")
          // @ts-expect-error idc
          .mockReturnValue(() => undefined);

        loadDotenv(mockInternal, CLI_SWITCHES, logger);
        expect(config).not.toHaveBeenCalled();
      });
    });
  });
});
