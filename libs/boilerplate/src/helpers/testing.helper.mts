import { faker } from "@faker-js/faker";
import { deepExtend, is, SINGLE, ZCC } from "@zcc/utilities";
import JSON from "comment-json";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { encode as iniEncode } from "ini";
import { dump as yamlDump } from "js-yaml";
import { homedir } from "os";
import { extname, join } from "path";
import { cwd } from "process";

import { ModuleConfiguration } from "../extensions/configuration.extension.mjs";
import { LOG_METRICS } from "./config.constants.mjs";
import { AbstractConfig } from "./config.helper.mjs";

export const TESTING_APP_NAME = "zcc-unit-tests";

export type RandomFileTestingDataFormat = ReturnType<typeof generateRandomData>;
function generateRandomData() {
  return {
    application: {
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

export function ConfigurationFiles() {
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

  return {
    dataMap: testDataMap,
    link: (paths?: string[]) => {
      is.unique(
        is.empty(paths)
          ? [cwd(), join(homedir(), ".config")].flatMap(base => [
              join(base, TESTING_APP_NAME),
              join(base, `${TESTING_APP_NAME}.json`),
              join(base, `${TESTING_APP_NAME}.ini`),
              join(base, `${TESTING_APP_NAME}.yaml`),
            ])
          : paths,
      ).forEach(filename => {
        const data = generateRandomData();
        writeConfigFile(filename, data);
      });
    },
    sort: (filePaths: string[]): string[] => {
      const dirOrder = [
        join("/etc", TESTING_APP_NAME, "config"),
        join("/etc", TESTING_APP_NAME, "config.json"),
        join("/etc", TESTING_APP_NAME, "config.ini"),
        join("/etc", TESTING_APP_NAME, "config.yaml"),
        join("/etc", `${TESTING_APP_NAME}rc`),
        join("/etc", `${TESTING_APP_NAME}rc.json`),
        join("/etc", `${TESTING_APP_NAME}rc.ini`),
        join("/etc", `${TESTING_APP_NAME}rc.yaml`),
        join(cwd(), `.${TESTING_APP_NAME}rc`),
        join(cwd(), `.${TESTING_APP_NAME}rc.json`),
        join(cwd(), `.${TESTING_APP_NAME}rc.ini`),
        join(cwd(), `.${TESTING_APP_NAME}rc.yaml`),
        join(homedir(), ".config", TESTING_APP_NAME),
        join(homedir(), ".config", `${TESTING_APP_NAME}.json`),
        join(homedir(), ".config", `${TESTING_APP_NAME}.ini`),
        join(homedir(), ".config", `${TESTING_APP_NAME}.yaml`),
        join(homedir(), ".config", TESTING_APP_NAME, "config"),
        join(homedir(), ".config", TESTING_APP_NAME, "config.json"),
        join(homedir(), ".config", TESTING_APP_NAME, "config.ini"),
        join(homedir(), ".config", TESTING_APP_NAME, "config.yaml"),
      ].reverse();

      return filePaths
        .filter(path => dirOrder.includes(path))
        .sort((a, b) => dirOrder.indexOf(a) - dirOrder.indexOf(b));
    },
    unlink: (path?: string) => {
      if (path) {
        if (testDataMap.has(path)) {
          existsSync(path) && unlinkSync(path);
          testDataMap.delete(path);
          return;
        }
        return;
      }
      testDataMap.forEach((_, filePath) => {
        existsSync(filePath) && unlinkSync(filePath);
      });
    },
  };
}

export async function bootTestingModule(
  configDefs?: ModuleConfiguration,
  environmentDefaults?: Partial<AbstractConfig>,
) {
  const application = ZCC.createApplication({
    application: TESTING_APP_NAME,
    configuration: configDefs,
  });
  environmentDefaults = deepExtend(
    {
      libs: {
        boilerplate: {
          // [LOG_LEVEL]: "warn",
          [LOG_METRICS]: false,
        },
      },
    },
    { ...environmentDefaults },
  );
  await ZCC.lifecycle.init(application, environmentDefaults);
  return application;
}