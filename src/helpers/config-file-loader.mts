import fs from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { cwd, platform } from "node:process";

import ini from "ini";
import yaml from "js-yaml";
import minimist from "minimist";

import { is } from "../index.mts";
import type { ConfigLoaderParams, ConfigLoaderReturn, ModuleConfiguration } from "./config.mts";
import { deepExtend } from "./extend.mts";
import { INVERT_VALUE, START } from "./utilities.mts";
import type { PartialConfiguration, ServiceMap } from "./wiring.mts";

const isWindows = platform === "win32";

export const SUPPORTED_CONFIG_EXTENSIONS = ["json", "ini", "yaml", "yml"];
export function withExtensions(path: string): string[] {
  return [path, join(path, "config")].flatMap(path => [
    path,
    ...SUPPORTED_CONFIG_EXTENSIONS.map(i => `${path}.${i}`),
  ]);
}

export function configFilePaths(name: string): string[] {
  const out: string[] = [];
  if (!isWindows) {
    out.push(...withExtensions(join(`/etc`, `${name}`)));
  }
  let current = cwd();
  let next: string;
  while (!is.empty(current)) {
    out.push(...withExtensions(join(current, `.${name}`)));
    next = join(current, "..");
    if (next === current) {
      break;
    }
    current = next;
  }
  out.push(...withExtensions(join(homedir(), ".config", name)));
  return out.filter(filePath => fs.existsSync(filePath) && fs.statSync(filePath).isFile());
}

export async function configLoaderFile<
  S extends ServiceMap = ServiceMap,
  C extends ModuleConfiguration = ModuleConfiguration,
>({ application, logger, internal }: ConfigLoaderParams<S, C>): ConfigLoaderReturn {
  const CLI_SWITCHES = minimist(process.argv);
  const configFile =
    CLI_SWITCHES.config ?? internal?.boot?.options?.configuration?.boilerplate?.CONFIG;
  let files: string[];
  if (is.boolean(configFile)) {
    logger.fatal({ argv: process.argv }, "system failed to parse argv");
    process.exit();
  } else if (is.empty(configFile)) {
    files = configFilePaths(application.name);
    logger.trace({ files, name: configLoaderFile }, `identified config files`);
  } else {
    if (!fs.existsSync(configFile)) {
      logger.fatal(
        { configFile, name: configLoaderFile },
        `used {--config} to specify path that does not exist`,
      );
      process.exit();
    }
    files = [configFile];
    logger.debug(
      { configFile, name: configLoaderFile },
      `used {--config}, loading from target file`,
    );
  }

  if (is.empty(files)) {
    return {};
  }
  const out: Partial<PartialConfiguration> = {};
  logger.trace({ files, name: configLoaderFile }, `loading configuration files`);
  files.forEach(file => loadConfigFromFile(out, file));
  return out;
}

export function loadConfigFromFile(out: PartialConfiguration, filePath: string) {
  const fileContent = fs.readFileSync(filePath, "utf8").trim();
  const hasExtension = SUPPORTED_CONFIG_EXTENSIONS.some(extension => {
    if (filePath.slice(extension.length * INVERT_VALUE).toLowerCase() === extension) {
      switch (extension) {
        case "ini":
          deepExtend(out, ini.decode(fileContent) as PartialConfiguration);
          return true;
        case "yaml":
        case "yml":
          deepExtend(out, yaml.load(fileContent) as PartialConfiguration);
          return true;
        case "json":
          deepExtend(out, JSON.parse(fileContent) as PartialConfiguration);
          return true;
      }
    }
    return false;
  });
  if (hasExtension) {
    return;
  }
  // Guessing JSON
  if (fileContent[START] === "{") {
    deepExtend(out, JSON.parse(fileContent) as PartialConfiguration);
    return;
  }
  // Guessing yaml
  try {
    const content = yaml.load(fileContent);
    if (is.object(content)) {
      deepExtend(out, content as PartialConfiguration);
      return;
    }
  } catch {
    // Is not a yaml file
  }
  // Final fallback: INI
  deepExtend(out, ini.decode(fileContent) as PartialConfiguration);
}
