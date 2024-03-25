import { faker } from "@faker-js/faker";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { encode as iniEncode } from "ini";
import { dump as yamlDump } from "js-yaml";
import { homedir } from "os";
import { extname, join } from "path";
import { cwd } from "process";

import { is } from "..";
import { SINGLE, TServiceParams } from "../helpers";

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

export type RandomFileTestingDataFormat = object;

export function ConfigTesting({ logger, internal }: TServiceParams) {
  const appName = internal.boot.application.name;
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
          ? [cwd(), join(homedir(), ".config")].flatMap((base) => [
              join(base, appName),
              join(base, `${appName}.json`),
              join(base, `${appName}.ini`),
              join(base, `${appName}.yaml`),
            ])
          : paths,
      ).forEach((filename) => {
        // console.log("FIXME: GENERATE RANDOM DATA", filename, writeConfigFile);
        const data = generateRandomData();
        writeConfigFile(filename, data);
        logger.info({ filename });
        filename;
        return writeConfigFile;
      });
    },
    sort: (filePaths: string[]): string[] => {
      const dirOrder = [
        join("/etc", appName, "config"),
        join("/etc", appName, "config.json"),
        join("/etc", appName, "config.ini"),
        join("/etc", appName, "config.yaml"),
        join("/etc", `${appName}`),
        join("/etc", `${appName}.json`),
        join("/etc", `${appName}.ini`),
        join("/etc", `${appName}.yaml`),
        join(cwd(), `.${appName}`),
        join(cwd(), `.${appName}.json`),
        join(cwd(), `.${appName}.ini`),
        join(cwd(), `.${appName}.yaml`),
        join(homedir(), ".config", appName),
        join(homedir(), ".config", `${appName}.json`),
        join(homedir(), ".config", `${appName}.ini`),
        join(homedir(), ".config", `${appName}.yaml`),
        join(homedir(), ".config", appName, "config"),
        join(homedir(), ".config", appName, "config.json"),
        join(homedir(), ".config", appName, "config.ini"),
        join(homedir(), ".config", appName, "config.yaml"),
      ].reverse();

      return filePaths
        .filter((path) => dirOrder.includes(path))
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
