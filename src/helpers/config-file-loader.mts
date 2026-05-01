/**
 * File-based configuration loader — reads JSON, YAML, and INI config files.
 *
 * @remarks
 * Supports four formats (JSON, YAML, INI, and auto-detect) and searches standard
 * config paths: `/etc/{app}`, `./{app}` (walking up the directory tree),
 * `~/.config/{app}`, and explicit `--config` flag overrides. Files are detected
 * by extension and parsed accordingly; if extension is ambiguous, format detection
 * occurs in order: JSON-like start, YAML parse, INI fallback. Multiple files are
 * merged using `deepExtend`, with earlier files providing defaults.
 */

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

/**
 * Supported config file extensions.
 */
export const SUPPORTED_CONFIG_EXTENSIONS = ["json", "ini", "yaml", "yml"];

/**
 * Generate potential file paths for a given base path.
 *
 * @remarks
 * Returns an array of paths including the base, a "config" subdirectory variant,
 * and all supported extensions of each. This is used to generate candidates
 * without checking filesystem; callers filter to existing files.
 *
 * @example
 * ```
 * withExtensions("myapp") returns:
 * ["myapp", "myapp.json", "myapp.ini", "myapp.yaml", "myapp.yml",
 *  "myapp/config", "myapp/config.json", ...]
 * ```
 */
export function withExtensions(path: string): string[] {
  return [path, join(path, "config")].flatMap(path => [
    path,
    ...SUPPORTED_CONFIG_EXTENSIONS.map(i => `${path}.${i}`),
  ]);
}

/**
 * Resolve all existing config files for an application.
 *
 * @remarks
 * Searches in order: `/etc/{name}` (Unix only), `./.{name}` (walking up the
 * directory tree), and `~/.config/{name}` (home directory). Returns only paths
 * that exist and are regular files. Used as the default search order when no
 * explicit `--config` flag is provided.
 */
export function configFilePaths(name: string): string[] {
  const out: string[] = [];
  // system-wide config (Unix only)
  if (!isWindows) {
    out.push(...withExtensions(join(`/etc`, `${name}`)));
  }
  // search up the directory tree from cwd
  let current = cwd();
  let next: string;
  while (!is.empty(current)) {
    out.push(...withExtensions(join(current, `.${name}`)));
    next = join(current, "..");
    // stop at filesystem root
    if (next === current) {
      break;
    }
    current = next;
  }
  // user-local config
  out.push(...withExtensions(join(homedir(), ".config", name)));
  // filter to existing regular files
  return out.filter(filePath => fs.existsSync(filePath) && fs.statSync(filePath).isFile());
}

/**
 * Load configuration from file(s).
 *
 * @remarks
 * Checks for an explicit `--config` CLI flag or `CONFIG` config value; if
 * provided and the file does not exist, exits fatally. Otherwise, searches
 * standard paths using `configFilePaths`. Merges all found files using
 * `deepExtend`, with earlier files as defaults.
 *
 * @throws {Error} (via process.exit) when `--config` points to a non-existent file
 * or when argv parsing fails.
 */
export async function configLoaderFile<
  S extends ServiceMap = ServiceMap,
  C extends ModuleConfiguration = ModuleConfiguration,
>({ application, logger, internal }: ConfigLoaderParams<S, C>): ConfigLoaderReturn {
  const CLI_SWITCHES = minimist(process.argv);
  const configFile =
    CLI_SWITCHES.config ?? internal?.boot?.options?.configuration?.boilerplate?.CONFIG;
  let files: string[];
  // argv parsing errors result in a boolean instead of a string
  if (is.boolean(configFile)) {
    logger.fatal({ argv: process.argv }, "system failed to parse argv");
    process.exit();
  } else if (is.empty(configFile)) {
    // no explicit config; search standard paths
    files = configFilePaths(application.name);
    logger.trace({ files, name: configLoaderFile }, `identified config files`);
  } else {
    // explicit config file provided; must exist
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

/**
 * Parse and merge a single config file into the output object.
 *
 * @remarks
 * Detects format by extension first; if ambiguous or no extension matches,
 * uses heuristics: if content starts with `{`, tries JSON; then YAML; finally
 * falls back to INI. File is merged into `out` using `deepExtend`.
 *
 * @example
 * ```
 * const config: PartialConfiguration = {};
 * loadConfigFromFile(config, "/etc/myapp.yaml");
 * // config is now merged with the file contents
 * ```
 */
export function loadConfigFromFile(out: PartialConfiguration, filePath: string) {
  const fileContent = fs.readFileSync(filePath, "utf8").trim();
  // check if filename has a recognized extension and parse accordingly
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
  // extension was recognized and parsed
  if (hasExtension) {
    return;
  }
  // no extension; try to detect format heuristically
  // JSON objects start with `{`
  if (fileContent[START] === "{") {
    deepExtend(out, JSON.parse(fileContent) as PartialConfiguration);
    return;
  }
  // try YAML (will throw if malformed)
  try {
    const content = yaml.load(fileContent);
    if (is.object(content)) {
      deepExtend(out, content as PartialConfiguration);
      return;
    }
  } catch {
    // not valid YAML; continue to INI fallback
  }
  // final fallback: treat as INI
  deepExtend(out, ini.decode(fileContent) as PartialConfiguration);
}
