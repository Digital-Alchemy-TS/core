import { existsSync, readFileSync, statSync } from "fs";
import { decode } from "ini";
import { load } from "js-yaml";
import { homedir } from "os";
import { join } from "path";
import { cwd, platform } from "process";

import { deepExtend, INVERT_VALUE, is, START } from "../..";
import {
  AbstractConfig,
  ConfigLoaderParams,
  ConfigLoaderReturn,
} from "./config.helper";

const isWindows = platform === "win32";

export const SUPPORTED_CONFIG_EXTENSIONS = ["json", "ini", "yaml", "yml"];
function withExtensions(path: string): string[] {
  return [path, ...SUPPORTED_CONFIG_EXTENSIONS.map((i) => `${path}.${i}`)];
}

export function configFilePaths(name = "digital-alchemy"): string[] {
  const out: string[] = [];
  if (!isWindows) {
    out.push(
      ...withExtensions(join(`/etc`, name, "config")),
      ...withExtensions(join(`/etc`, `${name}`)),
    );
  }
  let current = cwd();
  let next: string;
  while (!is.empty(current)) {
    out.push(join(current, `.${name}`), ...withExtensions(current));
    next = join(current, "..");
    if (next === current) {
      break;
    }
    current = next;
  }
  out.push(
    ...withExtensions(join(homedir(), ".config", name)),
    ...withExtensions(join(homedir(), ".config", name, "config")),
  );
  return out.filter(
    (filePath) => existsSync(filePath) && statSync(filePath).isFile(),
  );
}

export async function ConfigLoaderFile({
  application,
  logger,
}: ConfigLoaderParams): ConfigLoaderReturn {
  const files = configFilePaths(application.name);
  if (is.empty(files)) {
    return {};
  }
  const out: Partial<AbstractConfig> = {};
  logger.trace({ files }, `loading configuration files`);
  files.forEach((file) => loadConfigFromFile(out, file));
  return out;
}

function loadConfigFromFile(out: Partial<AbstractConfig>, filePath: string) {
  const fileContent = readFileSync(filePath, "utf8").trim();
  const hasExtension = SUPPORTED_CONFIG_EXTENSIONS.some((extension) => {
    if (
      filePath.slice(extension.length * INVERT_VALUE).toLowerCase() ===
      extension
    ) {
      switch (extension) {
        case "ini":
          deepExtend(out, decode(fileContent) as unknown as AbstractConfig);
          return true;
        case "yaml":
        case "yml":
          deepExtend(out, load(fileContent) as AbstractConfig);
          return true;
        case "json":
          deepExtend(out, JSON.parse(fileContent) as unknown as AbstractConfig);
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
    deepExtend(out, JSON.parse(fileContent) as unknown as AbstractConfig);
    return;
  }
  // Guessing yaml
  try {
    const content = load(fileContent);
    if (is.object(content)) {
      deepExtend(out, content as unknown as AbstractConfig);
      return;
    }
  } catch {
    // Is not a yaml file
  }
  // Final fallback: INI
  deepExtend(out, decode(fileContent) as unknown as AbstractConfig);
}
