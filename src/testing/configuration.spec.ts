import { faker } from "@faker-js/faker";
import dotenv from "dotenv";
import fs from "fs";
import { ParsedArgs } from "minimist";
import { join } from "path";
import { cwd, env } from "process";

import {
  ApplicationDefinition,
  ConfigLoaderFile,
  CreateApplication,
  CreateLibrary,
  ILogger,
  InternalConfig,
  InternalDefinition,
  loadDotenv,
  OptionalModuleConfiguration,
  parseConfig,
  ServiceMap,
  TServiceParams,
} from "..";
import { ConfigTesting } from "./config-testing.extension";
import { createMockLogger, TestRunner } from "./helpers";
import { BASIC_BOOT } from "./testing.helper";

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
      const spy = jest.fn().mockReturnValue({});
      await TestRunner()
        .configure({
          configLoader: async () => spy(),
        })
        .run(({ lifecycle }) => {
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
      await TestRunner().run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          expect(config.boilerplate.LOG_LEVEL).toBe("info");
        });
      });
    });

    it("should have the correct defaults for boilerplate", async () => {
      expect.assertions(2);
      await TestRunner().run(({ config, lifecycle, internal }) => {
        lifecycle.onPostConfig(() => {
          expect(config.boilerplate.CONFIG).toBe(undefined);
          expect(
            internal.boilerplate.configuration
              .getDefinitions()
              .get("boilerplate").LOG_LEVEL.default,
          ).toBe("trace");
        });
      });
    });

    it("should generate the correct structure for applications", async () => {
      expect.assertions(1);
      await TestRunner()
        .extras({
          module_config: {
            FOO: { default: "bar", type: "string" },
          },
        })
        .run(({ config }) => {
          // @ts-expect-error testing
          expect(config.testing.FOO).toBe("bar");
        });
    });

    it("should generate the correct structure for libraries", async () => {
      expect.assertions(1);
      await TestRunner()
        .appendLibrary(
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
        )
        .run(({ config, lifecycle }) => {
          lifecycle.onBootstrap(() => {
            // @ts-expect-error testing
            expect(config.library.RAINING).toBe(false);
          });
        });
    });
  });

  // #endregion
  // #region Loaders
  describe("Loaders", () => {
    describe("General", () => {
      afterEach(() => {
        delete env["DO_NOT_LOAD"];
      });

      it("cannot set whole objects", async () => {
        expect.assertions(1);
        await TestRunner().run(({ config }) => {
          expect(() => {
            // @ts-expect-error testing
            config.boilerplate = {};
          }).toThrow();
        });
      });

      it("can list available keys", async () => {
        expect.assertions(1);
        await TestRunner().run(({ config }) => {
          const key = Object.keys(config);
          expect(key).toEqual(expect.arrayContaining(["boilerplate"]));
        });
      });

      it("does has operator", async () => {
        expect.assertions(1);
        await TestRunner().run(({ config }) => {
          expect("boilerplate" in config).toBe(true);
        });
      });

      it("should not find variables without loaders", async () => {
        expect.assertions(1);
        env["DO_NOT_LOAD"] = "env";
        await TestRunner()
          .extras({
            module_config: {
              DO_NOT_LOAD: {
                default: "unloaded",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.DO_NOT_LOAD).toBe("unloaded");
            });
          });
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
        await TestRunner()
          .configure({ loadConfigs: true })
          .extras({
            module_config: {
              CURRENT_WEATHER: {
                default: "raining",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.CURRENT_WEATHER).toBe("raining");
            });
          });
      });

      it("should do direct match by key", async () => {
        expect.assertions(1);
        env["CURRENT_WEATHER"] = "windy";
        await TestRunner()
          .configure({ loadConfigs: true })
          .extras({
            module_config: {
              CURRENT_WEATHER: {
                default: "raining",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.CURRENT_WEATHER).toBe("windy");
            });
          });
      });

      it("should wrong case (all lower)", async () => {
        expect.assertions(1);
        env["current_weather"] = "sunny";
        await TestRunner()
          .configure({ loadConfigs: true })
          .extras({
            module_config: {
              CURRENT_WEATHER: {
                default: "raining",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.CURRENT_WEATHER).toBe("sunny");
            });
          });
      });

      it("should wrong case (mixed)", async () => {
        expect.assertions(1);
        env["current_WEATHER"] = "hail";
        await TestRunner()
          .configure({ loadConfigs: true })
          .extras({
            module_config: {
              CURRENT_WEATHER: {
                default: "raining",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.CURRENT_WEATHER).toBe("hail");
            });
          });
      });
    });

    // #MARK: CLI Switches
    describe("CLI Switch", () => {
      beforeEach(() => {
        process.argv = ["/path/to/node", "/path/to/main"];
      });

      it("should default properly if environment variables do not exist", async () => {
        expect.assertions(1);
        await TestRunner()
          .configure({ loadConfigs: true })
          .extras({
            module_config: {
              CURRENT_WEATHER: {
                default: "raining",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.CURRENT_WEATHER).toBe("raining");
            });
          });
      });

      it("should do direct match by key", async () => {
        expect.assertions(1);
        process.argv.push("--CURRENT_WEATHER", "windy");
        await TestRunner()
          .configure({ loadConfigs: true })
          .extras({
            module_config: {
              CURRENT_WEATHER: {
                default: "raining",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.CURRENT_WEATHER).toBe("windy");
            });
          });
      });

      it("should wrong case (all lower)", async () => {
        expect.assertions(1);
        process.argv.push("--current_weather", "sunny");
        await TestRunner()
          .configure({ loadConfigs: true })
          .extras({
            module_config: {
              CURRENT_WEATHER: {
                default: "raining",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.CURRENT_WEATHER).toBe("sunny");
            });
          });
      });

      it("should wrong case (mixed)", async () => {
        expect.assertions(1);
        process.argv.push("--current_WEATHER", "hail");
        await TestRunner()
          .configure({ loadConfigs: true })
          .extras({
            module_config: {
              CURRENT_WEATHER: {
                default: "raining",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.CURRENT_WEATHER).toBe("hail");
            });
          });
      });

      it("is valid with equals signs", async () => {
        expect.assertions(1);
        process.argv.push("--current_WEATHER=hail");
        await TestRunner()
          .configure({ loadConfigs: true })
          .extras({
            module_config: {
              CURRENT_WEATHER: {
                default: "raining",
                type: "string",
              },
            },
          })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.testing.CURRENT_WEATHER).toBe("hail");
            });
          });
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

  describe("Interactions", () => {
    it("throws errors for missing required config", async () => {
      expect.assertions(2);
      const spy = jest
        .spyOn(global.console, "error")
        .mockImplementation(() => undefined);
      // @ts-expect-error i don't care
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
      try {
        await TestRunner()
          .appendLibrary(
            CreateLibrary({
              configuration: {
                REQUIRED_CONFIG: { required: true, type: "string" },
              },
              // @ts-expect-error testing
              name: "library",
              services: {},
            }),
          )
          .run(() => {});
      } finally {
        expect(spy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalled();
      }
    });

    describe("onUpdate", () => {
      it("calls onUpdate when it changes", async () => {
        await TestRunner().run(
          ({
            internal: {
              boilerplate: { configuration },
            },
          }) => {
            const spy = jest.fn();
            configuration.onUpdate(spy);
            configuration.set("boilerplate", "LOG_LEVEL", "debug");
            expect(spy).toHaveBeenCalled();
          },
        );
      });

      it("does not call onUpdate when property doesn't match", async () => {
        await TestRunner().run(
          ({
            internal: {
              boilerplate: { configuration },
            },
          }) => {
            const spy = jest.fn();
            configuration.onUpdate(spy, "boilerplate", "config");
            configuration.set("boilerplate", "CONFIG", "debug");
            expect(spy).not.toHaveBeenCalled();
          },
        );
      });

      it("does not call onUpdate when project doesn't match", async () => {
        await TestRunner().run(
          ({
            internal: {
              boilerplate: { configuration },
            },
          }) => {
            const spy = jest.fn();
            configuration.onUpdate(spy, "boilerplate", "config");
            // @ts-expect-error I got nothing better here
            configuration.set("test", "CONFIG", "debug");
            expect(spy).not.toHaveBeenCalled();
          },
        );
      });
    });
  });
});
