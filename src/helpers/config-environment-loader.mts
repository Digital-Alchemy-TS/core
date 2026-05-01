/**
 * Environment variable and CLI switch config loader.
 *
 * @remarks
 * Reads config from Node.js env vars and command-line arguments. For each config
 * key, searches using a three-tier precedence: CLI switches (highest), then env
 * vars (middle), then defaults (lowest). Both argv and env sources support a
 * double-underscore variant (`MODULE__KEY`) in addition to single-underscore,
 * enabling env vars with embedded dots/slashes that would be shell-escaped.
 * Timing information is captured and returned for observability.
 */

import { env } from "node:process";

import minimist from "minimist";

import { is, NONE } from "../index.mts";
import type {
  AbstractConfig,
  ConfigLoaderParams,
  ConfigLoaderReturn,
  DataTypes,
  ModuleConfiguration,
} from "./config.mts";
import { findKey, iSearchKey, loadDotenv, parseConfig } from "./config.mts";
import type { ServiceMap } from "./wiring.mts";

/**
 * Load configuration from environment variables and CLI switches.
 *
 * @remarks
 * Merges CLI arguments and environment variables into the config tree, respecting
 * the configured sources (argv, env) and individual config key source restrictions.
 * Searches for each key in three forms (in order):
 * 1. `MODULE__KEY` (double underscore) — preferred, allows shell-escaped env vars
 * 2. `MODULE_KEY` (single underscore) — classic format
 * 3. `KEY` (bare key) — fallback for globals
 *
 * CLI arguments are checked first (highest precedence); env vars are checked second.
 * Both are optional and controlled by `internal.boot.options.configSources`.
 *
 * Timing data is collected for argv and env separately and returned if the
 * optional `timings` object is provided.
 *
 * @example
 * ```
 * // Search order for app.NODE_ENV config key:
 * // 1. --app__NODE_ENV cli switch
 * // 2. APP__NODE_ENV env var
 * // 3. --app_NODE_ENV cli switch
 * // 4. APP_NODE_ENV env var
 * // 5. --NODE_ENV cli switch
 * // 6. NODE_ENV env var
 * ```
 */
export async function ConfigLoaderEnvironment<
  S extends ServiceMap = ServiceMap,
  C extends ModuleConfiguration = ModuleConfiguration,
>({
  configs,
  internal,
  logger,
  timings,
}: ConfigLoaderParams<S, C> & { timings?: Record<string, string> }): ConfigLoaderReturn {
  const DECIMALS = 2;
  const CLI_SWITCHES = minimist(process.argv);
  const switchKeys = Object.keys(CLI_SWITCHES);
  const out: Partial<AbstractConfig> = {};
  const canEnvironment = internal.boot.options?.configSources?.env ?? true;
  const canArgv = internal.boot.options?.configSources?.argv ?? true;

  const shouldArgv = (source: DataTypes[]) =>
    canArgv && (!is.array(source) || source.includes("argv"));
  const shouldEnv = (source: DataTypes[]) =>
    canEnvironment && (!is.array(source) || source.includes("env"));

  // merge dotenv files and env-file switches into process.env
  loadDotenv(internal, CLI_SWITCHES, logger);
  const environmentKeys = Object.keys(env);

  // track timing for argv and env separately
  let argvTime = NONE;
  let envTime = NONE;

  // iterate through all module configurations
  configs.forEach((configuration, project) => {
    const cleanedProject = project.replaceAll("-", "_");

    // iterate through each config key within the module
    Object.keys(configuration).forEach(key => {
      const { source } = configs.get(project)[key];
      // search keys in order: double-underscore (preferred), single-underscore, bare key
      // double-underscore allows env var names with embedded special chars (dots, slashes)
      const noAppPath = `${cleanedProject}_${key}`;
      const noAppPathDouble = `${cleanedProject}__${key}`;
      const search = [noAppPathDouble, noAppPath, key];
      const configPath = `${project}.${key}`;

      if (canArgv) {
        // CLI switches take precedence; find a matching flag in the argv
        const argvStart = performance.now();
        const flag = findKey(search, switchKeys);
        if (flag && shouldArgv(source)) {
          const formattedFlag = iSearchKey(flag, switchKeys);
          internal.utils.object.set(
            out,
            configPath,
            parseConfig(configuration[key], CLI_SWITCHES[formattedFlag]),
          );
          argvTime += performance.now() - argvStart;
          logger.debug(
            {
              flag: formattedFlag,
              name: ConfigLoaderEnvironment,
              path: configPath,
            },
            `load config from [cli switch]`,
          );
          return;
        }
        argvTime += performance.now() - argvStart;
      }

      // fallback to environment variable if no CLI switch was found
      if (canEnvironment) {
        const envStart = performance.now();
        const environment = findKey(search, environmentKeys);
        if (!is.empty(environment) && shouldEnv(source)) {
          const environmentName = iSearchKey(environment, environmentKeys);
          // only set if the env var is defined and non-empty
          if (!is.string(env[environmentName]) || !is.empty(env[environmentName])) {
            internal.utils.object.set(
              out,
              configPath,
              parseConfig(configuration[key], env[environmentName]),
            );
          }
          envTime += performance.now() - envStart;
          logger.debug(
            {
              name: ConfigLoaderEnvironment,
              path: configPath,
              var: environmentName,
            },
            `load config from [env]`,
          );
        } else {
          envTime += performance.now() - envStart;
        }
      }
    });
  });

  // record timing if provided
  if (timings) {
    if (argvTime) {
      timings.argv = `${argvTime.toFixed(DECIMALS)}ms`;
    }
    if (envTime) {
      timings.env = `${envTime.toFixed(DECIMALS)}ms`;
    }
  }

  return out;
}
