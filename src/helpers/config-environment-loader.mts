import minimist from "minimist";
import { env } from "process";

import { is } from "../index.mts";
import {
  AbstractConfig,
  ConfigLoaderParams,
  ConfigLoaderReturn,
  DataTypes,
  findKey,
  iSearchKey,
  loadDotenv,
  ModuleConfiguration,
  parseConfig,
} from "./config.mts";
import { ServiceMap } from "./wiring.mts";

export async function ConfigLoaderEnvironment<
  S extends ServiceMap = ServiceMap,
  C extends ModuleConfiguration = ModuleConfiguration,
>({ configs, internal, logger }: ConfigLoaderParams<S, C>): ConfigLoaderReturn {
  const CLI_SWITCHES = minimist(process.argv);
  const switchKeys = Object.keys(CLI_SWITCHES);
  const out: Partial<AbstractConfig> = {};
  const canEnvironment = internal.boot.options?.configSources?.env ?? true;
  const canArgv = internal.boot.options?.configSources?.argv ?? true;

  const shouldArgv = (source: DataTypes[]) =>
    canArgv && (!is.array(source) || source.includes("argv"));
  const shouldEnv = (source: DataTypes[]) =>
    canEnvironment && (!is.array(source) || source.includes("env"));

  // * merge dotenv into local vars
  // accounts for `--env-file` switches, and whatever is passed in via bootstrap
  loadDotenv(internal, CLI_SWITCHES, logger);
  const environmentKeys = Object.keys(env);

  // * go through all module
  configs.forEach((configuration, project) => {
    const cleanedProject = project.replaceAll("-", "_");

    // * run through each config for module
    Object.keys(configuration).forEach(key => {
      const { source } = configs.get(project)[key];
      // > things to search for
      // - MODULE_NAME_CONFIG_KEY (module + key, ex: app_NODE_ENV)
      // - CONFIG_KEY (only key, ex: NODE_ENV)
      const noAppPath = `${cleanedProject}_${key}`;
      const search = [noAppPath, key];
      const configPath = `${project}.${key}`;

      // * (preferred) Find an applicable cli switch
      const flag = findKey(search, switchKeys);
      if (flag && shouldArgv(source)) {
        const formattedFlag = iSearchKey(flag, switchKeys);
        internal.utils.object.set(
          out,
          configPath,
          parseConfig(configuration[key], CLI_SWITCHES[formattedFlag]),
        );
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

      // * (fallback) Find an environment variable
      const environment = findKey(search, environmentKeys);
      if (!is.empty(environment) && shouldEnv(source)) {
        const environmentName = iSearchKey(environment, environmentKeys);
        if (!is.string(env[environmentName]) || !is.empty(env[environmentName])) {
          internal.utils.object.set(
            out,
            configPath,
            parseConfig(configuration[key], env[environmentName]),
          );
        }
        logger.debug(
          {
            name: ConfigLoaderEnvironment,
            path: configPath,
            var: environmentName,
          },
          `load config from [env]`,
        );
      }
    });
  });
  return out;
}
