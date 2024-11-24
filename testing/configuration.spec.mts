import { faker } from "@faker-js/faker";
import dotenv from "dotenv";
import fs, { existsSync, unlinkSync, writeFileSync } from "fs";
import { encode as iniEncode } from "ini";
import { dump as yamlDump } from "js-yaml";
import { ParsedArgs } from "minimist";
import { homedir } from "os";
import { extname, join } from "path";
import { cwd, env } from "process";
import { v4 } from "uuid";

import {
  ApplicationDefinition,
  BootstrapOptions,
  cast,
  configFilePaths,
  configLoaderFile,
  CreateApplication,
  CreateLibrary,
  createMockLogger,
  DataTypes,
  ILogger,
  InternalConfig,
  InternalDefinition,
  is,
  loadConfigFromFile,
  loadDotenv,
  OptionalModuleConfiguration,
  parseConfig,
  PartialConfiguration,
  ServiceMap,
  SINGLE,
  TestRunner,
  TServiceParams,
} from "../src/index.mts";

const BASIC_BOOT = {
  configuration: { boilerplate: { LOG_LEVEL: "silent" } },
  loggerOptions: {
    levelOverrides: {
      boilerplate: "warn",
    },
  },
} as BootstrapOptions;

export function ConfigTesting({ lifecycle }: TServiceParams) {
  const appName = "testing";
  const testDataMap = new Map<string, RandomFileTestingDataFormat>();

  function writeConfigFile(
    filePath: string,
    data: RandomFileTestingDataFormat,
    encodingType?: string,
  ) {
    let content;
    encodingType = encodingType || extname(filePath).slice(SINGLE) || "ini";

    switch (encodingType) {
      case "json":
        content = JSON.stringify(data);
        break;
      case "yaml":
        content = yamlDump(data);
        break;
      default:
        content = iniEncode(data); // Default to ini
        break;
    }

    writeFileSync(filePath, content);
    testDataMap.set(filePath, data);
  }

  function unlink(path?: string) {
    if (path) {
      if (testDataMap.has(path)) {
        if (existsSync(path)) {
          unlinkSync(path);
        }
        testDataMap.delete(path);
        return;
      }
      return;
    }
    testDataMap.forEach((_, filePath) => {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    });
  }

  lifecycle.onPreShutdown(() => {
    unlink();
    [...testDataMap.keys()].forEach(i => testDataMap.delete(i));
  });

  return {
    dataMap: testDataMap,
    link: (paths?: string[]) => {
      const list = is.unique(
        is.empty(paths)
          ? [cwd(), join(homedir(), ".config")].flatMap(base => [
              join(base, `.${appName}`),
              join(base, `.${appName}.json`),
              join(base, `.${appName}.ini`),
              join(base, `.${appName}.yaml`),
            ])
          : paths,
      );
      list.forEach(filename => {
        // console.log(testDataMap);
        writeConfigFile(filename, generateRandomData());
      });
      return list;
    },
    sort: (filePaths: string[]): string[] => {
      const dirOrder = [
        join("/etc", appName, "config"),
        join("/etc", appName, "config.json"),
        join("/etc", appName, "config.ini"),
        join("/etc", appName, "config.yaml"),
        join("/etc", appName, "config.yml"),
        join("/etc", `${appName}`),
        join("/etc", `${appName}.json`),
        join("/etc", `${appName}.ini`),
        join("/etc", `${appName}.yaml`),
        join("/etc", `${appName}.yml`),
        join(cwd(), `.${appName}`),
        join(cwd(), `.${appName}.json`),
        join(cwd(), `.${appName}.ini`),
        join(cwd(), `.${appName}.yaml`),
        join(cwd(), `.${appName}.yml`),
        join(homedir(), ".config", appName),
        join(homedir(), ".config", `${appName}.json`),
        join(homedir(), ".config", `${appName}.ini`),
        join(homedir(), ".config", `${appName}.yaml`),
        join(homedir(), ".config", `${appName}.yml`),
        join(homedir(), ".config", appName, "config"),
        join(homedir(), ".config", appName, "config.json"),
        join(homedir(), ".config", appName, "config.ini"),
        join(homedir(), ".config", appName, "config.yaml"),
        join(homedir(), ".config", appName, "config.yml"),
      ].reverse();

      return filePaths
        .filter(path => dirOrder.includes(path))
        .sort((a, b) => dirOrder.indexOf(a) - dirOrder.indexOf(b));
    },
    unlink,
  };
}

export type RandomFileTestingDataFormat = ReturnType<typeof generateRandomData>;
function generateRandomData() {
  return {
    testing: {
      boolean: faker.datatype.boolean(),
      internal: {
        mqtt: {
          host: faker.internet.ip(),
          port: faker.number.int({ max: 65_535, min: 1024 }),
        },
      },
      number: faker.number.int(),
      record: {
        key1: faker.lorem.word(),
        key2: faker.lorem.word(),
      },
      string: faker.lorem.word(),
      stringArray: [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()],
    },
  };
}

describe("Configuration", () => {
  let application: ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>;

  afterEach(async () => {
    process.argv = [""];
    if (application) {
      await application.teardown();
      application = undefined;
    }
    vi.restoreAllMocks();
  });

  // #MARK: Initialization
  describe("Initialization", () => {
    it("should be configured at the correct time in the lifecycle", async () => {
      expect.assertions(2);
      const spy = vi.fn().mockReturnValue({});
      await TestRunner().run(({ lifecycle, internal }) => {
        internal.config.registerLoader(spy, "test" as DataTypes);
        lifecycle.onPreInit(() => {
          expect(spy).not.toHaveBeenCalled();
        });
        lifecycle.onPostConfig(() => {
          expect(spy).toHaveBeenCalled();
        });
      });
    });

    it("defaults NODE_ENV to local", async () => {
      expect.assertions(1);
      env.NODE_ENV = "";
      await TestRunner().run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          expect(config.boilerplate.NODE_ENV).toBe("local");
        });
      });
    });

    it("uses NODE_ENV if set", async () => {
      expect.assertions(1);
      const id = v4();
      env.NODE_ENV = id;
      await TestRunner().run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          expect(config.boilerplate.NODE_ENV).toBe(id);
        });
      });
    });

    it("should prioritize bootstrap config over defaults", async () => {
      expect.assertions(1);
      await TestRunner()
        .setOptions({ configuration: { boilerplate: { LOG_LEVEL: "info" } } })
        .run(({ config, lifecycle }) => {
          lifecycle.onPostConfig(() => {
            expect(config.boilerplate.LOG_LEVEL).toBe("info");
          });
        });
    });

    it("should have the correct defaults for boilerplate", async () => {
      expect.assertions(1);
      await TestRunner().run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          expect(config.boilerplate.LOG_LEVEL).toBe("trace");
        });
      });
    });

    it("should generate the correct structure for applications", async () => {
      expect.assertions(1);
      await TestRunner()
        .setOptions({
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

  // #MARK: cast
  describe("cast", () => {
    it("should cast to boolean", () => {
      expect(cast("true", "boolean")).toBe(true);
      expect(cast("false", "boolean")).toBe(false);
      expect(cast("y", "boolean")).toBe(true);
      expect(cast("n", "boolean")).toBe(false);
      expect(cast("1", "boolean")).toBe(true);
      expect(cast("0", "boolean")).toBe(false);
      expect(cast(undefined, "boolean")).toBe(false);
      expect(cast(null, "boolean")).toBe(false);
      expect(cast(true, "boolean")).toBe(true);
      expect(cast(false, "boolean")).toBe(false);
    });

    it("should cast to number", () => {
      expect(cast("123", "number")).toBe(123);
      expect(cast("0", "number")).toBe(0);
      expect(cast("12.34", "number")).toBe(12.34);
      expect(cast("invalid", "number")).toBeNaN();
      expect(cast(undefined, "number")).toBeNaN();
    });

    it("should cast to string[]", () => {
      expect(cast("foo", "string[]")).toEqual(["foo"]);
      expect(cast(["foo", "bar"], "string[]")).toEqual(["foo", "bar"]);
      expect(cast(undefined, "string[]")).toEqual([]);
      expect(cast(null, "string[]")).toEqual(["null"]);
      expect(cast("123", "string[]")).toEqual(["123"]);
    });

    it("should return data unchanged if type is not handled", () => {
      expect(cast("unchanged", "unknown")).toBe("unchanged");
      expect(cast([1, 2, 3], "unknown")).toEqual([1, 2, 3]);
    });
  });

  // #MARK: Loaders
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
          .setOptions({ loadConfigs: true })
          .setOptions({
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
          .setOptions({ loadConfigs: true })
          .setOptions({
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
          .setOptions({ loadConfigs: true })
          .setOptions({
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

      it("ignores when env is disabled", async () => {
        expect.assertions(1);
        env["current_weather"] = "sunny";
        await TestRunner()
          .setOptions({ configSources: { env: false } })
          .setOptions({
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

      it("ignore non-matching source", async () => {
        expect.assertions(1);
        env["BAR"] = "fizz";
        await TestRunner()
          .appendLibrary(
            CreateLibrary({
              configuration: {
                BAR: {
                  default: "buzz",
                  source: [],
                  type: "string",
                },
              },
              // @ts-expect-error testing
              name: "foo",
              services: {},
            }),
          )
          .setOptions({ loadConfigs: true })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.foo.BAR).toBe("buzz");
            });
          });
      });

      it("matches correct source", async () => {
        expect.assertions(1);
        env["BAR"] = "fizz";
        await TestRunner()
          .appendLibrary(
            CreateLibrary({
              configuration: {
                BAR: {
                  default: "buzz",
                  source: ["env"],
                  type: "string",
                },
              },
              // @ts-expect-error testing
              name: "foo",
              services: {},
            }),
          )
          .setOptions({ loadConfigs: true })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.foo.BAR).toBe("fizz");
            });
          });
      });

      it("matches any source", async () => {
        expect.assertions(1);
        env["BAR"] = "fizz";
        await TestRunner()
          .appendLibrary(
            CreateLibrary({
              configuration: {
                BAR: {
                  default: "buzz",
                  type: "string",
                },
              },
              // @ts-expect-error testing
              name: "foo",
              services: {},
            }),
          )
          .setOptions({ loadConfigs: true })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.foo.BAR).toBe("fizz");
            });
          });
      });

      it("should wrong case (mixed)", async () => {
        expect.assertions(1);
        env["current_WEATHER"] = "hail";
        await TestRunner()
          .setOptions({ loadConfigs: true })
          .setOptions({
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
          .setOptions({ loadConfigs: true })
          .setOptions({
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
          .setOptions({ loadConfigs: true })
          .setOptions({
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
          .setOptions({ loadConfigs: true })
          .setOptions({
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
          .setOptions({ loadConfigs: true })
          .setOptions({
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

      it("ignore when disabled", async () => {
        expect.assertions(1);
        process.argv.push("--current_WEATHER", "hail");
        await TestRunner()
          .setOptions({ configSources: { argv: false }, loadConfigs: true })
          .setOptions({
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

      it("ignore non-matching source", async () => {
        expect.assertions(1);
        process.argv.push("--BAR", "fizz");
        await TestRunner()
          .appendLibrary(
            CreateLibrary({
              configuration: {
                BAR: {
                  default: "buzz",
                  source: [],
                  type: "string",
                },
              },
              // @ts-expect-error testing
              name: "foo",
              services: {},
            }),
          )
          .setOptions({ loadConfigs: true })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.foo.BAR).toBe("buzz");
            });
          });
      });

      it("matches correct source", async () => {
        expect.assertions(1);
        process.argv.push("--BAR", "fizz");
        await TestRunner()
          .appendLibrary(
            CreateLibrary({
              configuration: {
                BAR: {
                  default: "buzz",
                  source: ["argv"],
                  type: "string",
                },
              },
              // @ts-expect-error testing
              name: "foo",
              services: {},
            }),
          )
          .setOptions({ loadConfigs: true })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.foo.BAR).toBe("fizz");
            });
          });
      });

      it("matches any source", async () => {
        expect.assertions(1);
        process.argv.push("--BAR", "fizz");
        await TestRunner()
          .appendLibrary(
            CreateLibrary({
              configuration: {
                BAR: {
                  default: "buzz",
                  type: "string",
                },
              },
              // @ts-expect-error testing
              name: "foo",
              services: {},
            }),
          )
          .setOptions({ loadConfigs: true })
          .run(({ config, lifecycle }) => {
            lifecycle.onPostConfig(() => {
              // @ts-expect-error testing
              expect(config.foo.BAR).toBe("fizz");
            });
          });
      });

      it("is valid with equals signs", async () => {
        expect.assertions(1);
        process.argv.push("--current_WEATHER=hail");
        await TestRunner()
          .setOptions({ loadConfigs: true })
          .setOptions({
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
        let testFiles: ReturnType<typeof ConfigTesting> = undefined;

        vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "warn").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
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
            configurationLoaders: [configLoaderFile],
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

      it("auto detects paths", async () => {
        vi.spyOn(fs, "existsSync").mockReturnValueOnce(true);
        // @ts-expect-error rest isn't needed
        vi.spyOn(fs, "statSync").mockImplementation(() => ({ isFile: () => true }));
        const spy = vi.spyOn(is, "empty").mockImplementation(() => true);
        await configLoaderFile({
          application: {
            // @ts-expect-error testing
            name: "test",
          },
          configs: undefined,
          internal: undefined,
          logger: createMockLogger(),
        });
        expect(spy).toHaveBeenCalledWith(["/etc/test"]);
      });

      // #MARK: --config
      describe("--config", () => {
        it("handles bad parsing", async () => {
          expect.assertions(1);
          process.argv = ["", "--config"];
          const error = new Error("HIT");
          vi.spyOn(process, "exit").mockImplementation(() => {
            throw error;
          });
          const logger = createMockLogger();
          try {
            await configLoaderFile({
              // @ts-expect-error not needed for test
              application: {},
              logger,
            });
          } catch (error) {
            expect(error).toBeDefined();
          }
        });

        it("does not like missing files", async () => {
          expect.assertions(1);
          process.argv = ["", "--config=./missing_file"];
          const error = new Error("HIT");
          vi.spyOn(process, "exit").mockImplementation(() => {
            throw error;
          });
          const logger = createMockLogger();
          try {
            await configLoaderFile({
              // @ts-expect-error not needed for test
              application: {},
              logger,
            });
          } catch (error) {
            expect(error).toBeDefined();
          }
        });

        it("will attempt to load existing files", async () => {
          vi.spyOn(fs, "existsSync").mockImplementation(() => true);

          const readSpy = vi.spyOn(fs, "readFileSync").mockImplementation(() => ``);
          const logger = createMockLogger();
          process.argv = ["", "--config=./config_file"];
          await configLoaderFile({
            // @ts-expect-error not needed for test
            application: {},
            logger,
          });

          expect(readSpy).toHaveBeenCalledWith("./config_file", "utf8");
        });
      });

      // #MARK: loadConfigFromFile
      describe("loadConfigFromFile", () => {
        it("configFilePaths returns empty array for all missing files", async () => {
          vi.spyOn(fs, "existsSync").mockImplementation(() => false);
          const out = configFilePaths("test");
          expect(out).toEqual([]);
        });

        it("configFilePaths does not return non-files", async () => {
          vi.spyOn(fs, "existsSync").mockImplementation(() => true);
          // @ts-expect-error rest isn't needed
          vi.spyOn(fs, "statSync").mockImplementation(() => ({ isFile: () => false }));
          const out = configFilePaths("test");
          expect(out).toEqual([]);
        });

        it("configFilePaths returns paths to files", async () => {
          vi.spyOn(fs, "existsSync").mockImplementation(() => true);
          // @ts-expect-error rest isn't needed
          vi.spyOn(fs, "statSync").mockImplementation(() => ({ isFile: () => true }));
          const out = configFilePaths("test");
          expect(out).not.toEqual([]);
        });

        // #MARK: with ext
        describe("with extension", () => {
          it("detects ini extension", async () => {
            const data = {} as PartialConfiguration;
            vi.spyOn(fs, "readFileSync").mockImplementation(() =>
              iniEncode({
                boilerplate: {
                  LOG_LEVEL: "trace",
                },
              } satisfies PartialConfiguration),
            );
            loadConfigFromFile(data, "/path/to/file.ini");
            expect(data.boilerplate.LOG_LEVEL).toBe("trace");
          });

          it("detects yaml extension", async () => {
            const data = {} as PartialConfiguration;
            vi.spyOn(fs, "readFileSync").mockImplementation(() =>
              yamlDump({
                boilerplate: {
                  LOG_LEVEL: "trace",
                },
              } satisfies PartialConfiguration),
            );
            loadConfigFromFile(data, "/path/to/file.yaml");
            expect(data.boilerplate.LOG_LEVEL).toBe("trace");
          });

          it("detects yml extension", async () => {
            const data = {} as PartialConfiguration;
            vi.spyOn(fs, "readFileSync").mockImplementation(() =>
              yamlDump({
                boilerplate: {
                  LOG_LEVEL: "trace",
                },
              } satisfies PartialConfiguration),
            );
            loadConfigFromFile(data, "/path/to/file.yml");
            expect(data.boilerplate.LOG_LEVEL).toBe("trace");
          });

          it("detects json extension", async () => {
            const data = {} as PartialConfiguration;
            vi.spyOn(fs, "readFileSync").mockImplementation(() =>
              JSON.stringify({
                boilerplate: {
                  LOG_LEVEL: "trace",
                },
              } satisfies PartialConfiguration),
            );
            loadConfigFromFile(data, "/path/to/file.json");
            expect(data.boilerplate.LOG_LEVEL).toBe("trace");
          });
        });

        // #MARK: no ext
        describe("without extension", () => {
          it("detects json data", async () => {
            const data = {} as PartialConfiguration;
            vi.spyOn(fs, "readFileSync").mockImplementation(() =>
              JSON.stringify({
                boilerplate: {
                  LOG_LEVEL: "trace",
                },
              } satisfies PartialConfiguration),
            );
            loadConfigFromFile(data, "/path/to/file");
            expect(data.boilerplate.LOG_LEVEL).toBe("trace");
          });

          it("detects ini data", async () => {
            const data = {} as PartialConfiguration;
            vi.spyOn(fs, "readFileSync").mockImplementation(() =>
              iniEncode({
                boilerplate: {
                  LOG_LEVEL: "trace",
                },
              } satisfies PartialConfiguration),
            );
            loadConfigFromFile(data, "/path/to/file");
            expect(data.boilerplate.LOG_LEVEL).toBe("trace");
          });

          it("detects yaml data", async () => {
            const data = {} as PartialConfiguration;
            vi.spyOn(fs, "readFileSync").mockImplementation(() =>
              yamlDump({
                boilerplate: {
                  LOG_LEVEL: "trace",
                },
              } satisfies PartialConfiguration),
            );
            loadConfigFromFile(data, "/path/to/file");
            expect(data.boilerplate.LOG_LEVEL).toBe("trace");
          });
        });
      });
    });
  });

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
        const output = parseConfig({ enum: ["hello", "world"], type: "string" }, value);
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
        const output = parseConfig({ type: "internal" } as InternalConfig<object>, value);
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

    // #MARK: loadDotenv
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
        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        const config = vi
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
        const config = vi
          .spyOn(dotenv, "config")
          // @ts-expect-error idc
          .mockReturnValue(() => undefined);
        vi.spyOn(fs, "existsSync").mockReturnValue(true);
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

      it("should load env file from bootstrap if CLI switch is not provided (absolute)", () => {
        const config = vi
          .spyOn(dotenv, "config")
          // @ts-expect-error idc
          .mockReturnValue(() => undefined);
        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        mockInternal.boot.options.envFile = "/path/to/bootstrap-env-file";

        const CLI_SWITCHES = {
          _: [],
          "env-file": "",
        } as ParsedArgs;

        loadDotenv(mockInternal, CLI_SWITCHES, logger);

        expect(config).toHaveBeenCalledWith({
          override: true,
          path: "/path/to/bootstrap-env-file",
        });
      });

      it("should load default .env file if no CLI switch or bootstrap envFile is provided", () => {
        mockInternal.boot.options.envFile = "";
        vi.spyOn(fs, "existsSync").mockReturnValue(true);

        const config = vi
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
        vi.spyOn(fs, "existsSync").mockReturnValue(false);

        const config = vi
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
        vi.spyOn(fs, "existsSync").mockReturnValue(false);

        const config = vi
          .spyOn(dotenv, "config")
          // @ts-expect-error idc
          .mockReturnValue(() => undefined);

        loadDotenv(mockInternal, CLI_SWITCHES, logger);
        expect(config).not.toHaveBeenCalled();
      });
    });
  });

  // #MARK: Interactions
  describe("Interactions", () => {
    it("loads app configs with bootLibrariesFirst", async () => {
      expect.assertions(1);
      const app = CreateApplication({
        configuration: {
          EXAMPLE_CONFIG: {
            default: "example",
            type: "string",
          },
        },

        configurationLoaders: [],
        // @ts-expect-error test
        name: "test",
        services: {
          Test({ config }) {
            // @ts-expect-error test
            expect(config.test.EXAMPLE_CONFIG).toBe("example");
          },
        },
      });
      await app.bootstrap({
        configuration: { boilerplate: { LOG_LEVEL: "silent" } },
      });
    });

    it("calls onUpdate when it changes", async () => {
      await TestRunner().run(
        ({
          internal: {
            boilerplate: { configuration },
          },
        }) => {
          const spy = vi.fn();
          configuration.onUpdate(spy);
          configuration.set("boilerplate", "LOG_LEVEL", "debug");
          expect(spy).toHaveBeenCalled();
        },
      );
    });

    it("can retrieve original config definitions", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.boilerplate.configuration.getDefinitions()).toBeDefined();
      });
    });

    it("returns objects for unknown projects", async () => {
      expect.assertions(1);
      await TestRunner().run(({ config }) => {
        // @ts-expect-error test
        expect(config.thing).toEqual({});
      });
    });

    it("throws errors during boot for missing required configs", async () => {
      expect.assertions(2);
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

      await TestRunner()
        .appendLibrary(
          CreateLibrary({
            configuration: {
              TEST_CONFIG: {
                required: true,
                type: "string",
              },
            },
            // @ts-expect-error testing
            name: "test_library",
            services: {},
          }),
        )
        .run(() => {});
      expect(spy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalled();
    });

    // #MARK: onUpdate
    describe("onUpdate", () => {
      it("calls onUpdate when it changes", async () => {
        await TestRunner().run(
          ({
            internal: {
              boilerplate: { configuration },
            },
          }) => {
            const spy = vi.fn();
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
            const spy = vi.fn();
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
            const spy = vi.fn();
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
