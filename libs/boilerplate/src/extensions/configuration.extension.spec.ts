import { faker } from "@faker-js/faker";
import { ZCC_Testing } from "@zcc/utilities";

import {
  CodeConfigDefinition,
  ConfigurationFiles,
  OptionalModuleConfiguration,
  RandomFileTestingDataFormat,
  ServiceMap,
  TESTING_APP_NAME,
  ZCCApplicationDefinition,
} from "../helpers/index";
import { ConfigManager, ZCC_Configuration } from "./configuration.extension";
import { CreateApplication } from "./wiring.extension";

describe("Configuration Extension Tests", () => {
  const originalEnvironment = process.env;
  const originalArgv = process.argv;
  let loadedModule: ZCCApplicationDefinition<
    ServiceMap,
    OptionalModuleConfiguration
  >;
  let config: ConfigManager;
  const testFiles = ConfigurationFiles();
  const APPLICATION = Symbol.for("APPLICATION_CONFIGURATION");

  async function CreateStandardTestModule() {
    loadedModule = CreateApplication({
      configuration: {
        boolean: { default: false, type: "boolean" },
        internal: { type: "internal" },
        number: { default: 0, type: "number" },
        record: { type: "record" },
        string: { default: "", type: "string" },
        stringArray: { default: [], type: "string[]" },
      },
      name: TESTING_APP_NAME,
    });
    await loadedModule.bootstrap();
  }

  beforeAll(() => {
    config = ZCC_Configuration();
  });

  beforeEach(() => {
    config.testReset();
  });

  afterEach(async () => {
    if (loadedModule) {
      await loadedModule.teardown();
      loadedModule = undefined;
    }
    ZCC_Testing.WiringReset();
  });

  describe("Pre-Initialization Tests", () => {
    describe("set method", () => {
      it("should set an application configuration value", () => {
        config.set("testPath", "testValue");
        expect(config.get("testPath")).toBe("testValue");
      });

      it("should set a library configuration value", () => {
        config.set(["testLibrary", "testPath"], "testValue");
        expect(config.get(["testLibrary", "testPath"])).toBe("testValue");
      });
    });

    describe("setApplicationDefinition method", () => {
      it("should add an application definition", () => {
        // Define a mock application configuration
        const mockAppConfig: CodeConfigDefinition = {
          anotherKey: { default: 10, type: "number" },
          key: { type: "string" },
        };

        // Add this configuration to the application definitions
        config.setApplicationDefinition({
          ...mockAppConfig,
          extra: { type: "number" },
        });

        // Retrieve the current configuration definitions
        const definitions = config.getConfigDefinitions();

        // Verify that each property in mockAppConfig exists in the retrieved configuration and has the correct value
        const retrievedConfig = definitions.get(APPLICATION);
        expect(definitions.has(APPLICATION)).toBe(true);
        expect(retrievedConfig).toBeDefined();

        for (const key in mockAppConfig) {
          expect(retrievedConfig).toHaveProperty(key);
          expect(retrievedConfig[key]).toEqual(mockAppConfig[key]);
        }
      });

      describe("Default Configuration Value Tests", () => {
        const libraryName = faker.lorem.word();

        it("should return a default string value", () => {
          config.setApplicationDefinition({
            myString: { default: "defaultString", type: "string" },
          });
          expect(config.get("myString")).toBe("defaultString");
        });

        it("should return a default boolean value", () => {
          config.setApplicationDefinition({
            myBoolean: { default: true, type: "boolean" },
          });
          expect(config.get("myBoolean")).toBe(true);
        });

        it("should return a default number value", () => {
          config.setApplicationDefinition({
            myNumber: { default: 42, type: "number" },
          });
          expect(config.get("myNumber")).toBe(42);
        });

        it("should return a default record value", () => {
          const recordValue = { key1: "value1", key2: "value2" };
          config.setApplicationDefinition({
            myRecord: { default: recordValue, type: "record" },
          });
          expect(config.get("myRecord")).toEqual(recordValue);
        });

        it("should return a default string array value", () => {
          config.setApplicationDefinition({
            myStringArray: {
              default: ["one", "two", "three"],
              type: "string[]",
            },
          });
          expect(config.get("myStringArray")).toEqual(["one", "two", "three"]);
        });

        it("should return a default internal value", () => {
          const mqttConfig = {
            host: "localhost",
            options: { keepalive: 60 },
            port: 1883,
          };
          config.setApplicationDefinition({
            myInternal: { default: mqttConfig, type: "internal" },
          });
          expect(config.get("myInternal")).toEqual(mqttConfig);
        });

        it("should return a default string value for a library", () => {
          config.addLibraryDefinition(libraryName, {
            libString: { default: "libDefaultString", type: "string" },
          });
          expect(config.get([libraryName, "libString"])).toBe(
            "libDefaultString",
          );
          expect(config.get("libString")).toBeUndefined();
        });

        it("should return a default boolean value for a library", () => {
          config.addLibraryDefinition(libraryName, {
            libBoolean: { default: false, type: "boolean" },
          });
          expect(config.get([libraryName, "libBoolean"])).toBe(false);
          expect(config.get("libBoolean")).toBeUndefined();
        });

        it("should return a default number value for a library", () => {
          config.addLibraryDefinition(libraryName, {
            libNumber: { default: 99, type: "number" },
          });
          expect(config.get([libraryName, "libNumber"])).toBe(99);
          expect(config.get("libNumber")).toBeUndefined();
        });

        it("should return a default record value for a library", () => {
          const recordValue = { keyA: "valueA", keyB: "valueB" };
          config.addLibraryDefinition(libraryName, {
            libRecord: { default: recordValue, type: "record" },
          });
          expect(config.get([libraryName, "libRecord"])).toEqual(recordValue);
          expect(config.get("libRecord")).toBeUndefined();
        });

        it("should return a default string array value for a library", () => {
          config.addLibraryDefinition(libraryName, {
            libStringArray: {
              default: ["alpha", "beta", "gamma"],
              type: "string[]",
            },
          });
          expect(config.get([libraryName, "libStringArray"])).toEqual([
            "alpha",
            "beta",
            "gamma",
          ]);
          expect(config.get("libStringArray")).toBeUndefined();
        });

        it("should return a default internal value for a library", () => {
          const internalConfig = {
            nested: { key: 123 },
            parameter: "value",
          };
          config.addLibraryDefinition(libraryName, {
            libInternal: { default: internalConfig, type: "internal" },
          });
          expect(config.get([libraryName, "libInternal"])).toEqual(
            internalConfig,
          );
          expect(config.get("libInternal")).toBeUndefined();
        });
      });

      it("should return a default boolean value for a library", () => {
        const libraryName = faker.lorem.word();
        config.addLibraryDefinition(libraryName, {
          libBoolean: { default: false, type: "boolean" },
        });
        expect(config.get([libraryName, "libBoolean"])).toBe(false);
        expect(config.get("libBoolean")).toBeUndefined();
      });
    });
  });

  describe("Dynamic Config Injection Tests", () => {
    it("should prioritize an already set value over library/application config and dynamic config", () => {
      const setStringValue = faker.lorem.word();
      const dynamicDefaultValue = faker.lorem.word();

      // Set a value directly
      config.set("thing", setStringValue);

      // Retrieve the value with dynamic config as fallback
      expect(
        config.get("thing", { default: dynamicDefaultValue, type: "string" }),
      ).toBe(setStringValue);
    });

    it("should prioritize library/application config over dynamic config when no value is set", () => {
      const libraryName = faker.lorem.word();
      const appConfigValue = faker.lorem.word();
      const dynamicDefaultValue = faker.lorem.word();

      // Add a library/application level configuration
      config.addLibraryDefinition(libraryName, {
        thing: { default: appConfigValue, type: "string" },
      });

      // Retrieve the value with dynamic config as fallback
      expect(
        config.get([libraryName, "thing"], {
          default: dynamicDefaultValue,
          type: "string",
        }),
      ).toBe(appConfigValue);
      expect(
        config.get("thing", { default: dynamicDefaultValue, type: "string" }),
      ).not.toBe(appConfigValue);
    });

    it("should use the dynamic default value when no other configuration is set", () => {
      const dynamicDefaultValue = faker.lorem.word();

      // Retrieve the value with only dynamic config defined
      expect(
        config.get("thing", { default: dynamicDefaultValue, type: "string" }),
      ).toBe(dynamicDefaultValue);
    });
  });

  describe("Type Coercion Tests", () => {
    let prioritizedFilePath: string;
    let prioritizedData: RandomFileTestingDataFormat;
    beforeAll(async () => {
      testFiles.link();
      const sortedFiles = testFiles.sort([...testFiles.dataMap.keys()]);
      prioritizedFilePath = sortedFiles[0];
      prioritizedData = testFiles.dataMap.get(prioritizedFilePath);
    });

    afterAll(() => {
      testFiles.unlink();
    });

    beforeEach(async () => {
      await CreateStandardTestModule();
      config.loadConfig(loadedModule);
    });

    it("should correctly coerce boolean type", () => {
      expect(config.get("boolean")).toBe(prioritizedData.application.boolean);
    });

    it("should correctly coerce number type", () => {
      expect(config.get("number")).toBe(prioritizedData.application.number);
    });

    it("should correctly coerce string type", () => {
      expect(config.get("string")).toBe(prioritizedData.application.string);
    });

    it("should correctly coerce string array type", () => {
      expect(config.get("stringArray")).toEqual(
        prioritizedData.application.stringArray,
      );
    });

    it("should correctly coerce record type", () => {
      expect(config.get("record")).toEqual(prioritizedData.application.record);
    });

    it("should correctly coerce internal type", () => {
      expect(config.get("internal")).toEqual(
        prioritizedData.application.internal,
      );
    });
  });

  describe("File Priority and Configuration Validation", () => {
    beforeAll(() => {
      // Create and write data to configuration files
      testFiles.link();
    });

    afterAll(() => {
      // Clean up any remaining files
      testFiles.unlink();
    });

    beforeEach(async () => {
      await CreateStandardTestModule();
    });

    it("should validate configuration as per file priority", async () => {
      let sortedFiles = testFiles.sort([...testFiles.dataMap.keys()]);

      for (const filePath of sortedFiles) {
        const expectedData = testFiles.dataMap.get(filePath).application.string;

        // Load configuration
        await config.loadConfig(loadedModule);
        expect(config.get("string")).toBe(expectedData);

        // Unlink the highest priority file and reset for the next iteration
        testFiles.unlink(filePath);
        config.testReset();

        // Update sortedFiles for the next iteration
        sortedFiles = testFiles.sort([...testFiles.dataMap.keys()]);
      }
    });
  });

  describe("Environment Variables and Argv Configuration Tests", () => {
    beforeEach(async () => {
      process.env = { ...originalEnvironment };
      process.argv = [...originalArgv];
    });

    it("should prioritize argv over environment variables and file configs", async () => {
      const argvTestValue = faker.lorem.word();
      process.argv.push(`--ARGV_TEST=${argvTestValue}`);

      loadedModule = CreateApplication({
        configuration: {
          ARGV_TEST: { default: "module default", type: "string" },
        },
        name: TESTING_APP_NAME,
      });
      config.setApplicationDefinition(loadedModule.configuration);
      await config.loadConfig(loadedModule);

      expect(config.get("ARGV_TEST")).toBe(argvTestValue);
    });

    it("should prioritize environment variables over file configs", async () => {
      const environmentTestValue = faker.lorem.word();
      process.env[`ENVIRONMENT_TEST`] = environmentTestValue;

      loadedModule = CreateApplication({
        configuration: {
          ENVIRONMENT_TEST: { default: "module default", type: "string" },
        },
        name: TESTING_APP_NAME,
      });
      config.setApplicationDefinition(loadedModule.configuration);
      await config.loadConfig(loadedModule);

      expect(config.get("ENVIRONMENT_TEST")).toBe(environmentTestValue);
    });
  });
});
