import minimist from "minimist";
import { argv, env } from "process";

import { is, ServiceMap } from "..";
import {
  AbstractConfig,
  ConfigLoaderParams,
  ConfigLoaderReturn,
  findKey,
  iSearchKey,
  loadDotenv,
  ModuleConfiguration,
  parseConfig,
} from "./config.helper";

export async function ConfigLoaderEnvironment<
  S extends ServiceMap = ServiceMap,
  C extends ModuleConfiguration = ModuleConfiguration,
>({ configs, internal, logger }: ConfigLoaderParams<S, C>): ConfigLoaderReturn {
  const CLI_SWITCHES = minimist(argv);
  const switchKeys = Object.keys(CLI_SWITCHES);
  const out: Partial<AbstractConfig> = {};

  // * merge dotenv into local vars
  // accounts for `--env-file` switches, and whatever is passed in via bootstrap
  loadDotenv(internal, CLI_SWITCHES, logger);
  const environmentKeys = Object.keys(env);

  // * go through all module
  configs.forEach((configuration, project) => {
    const cleanedProject = project.replaceAll("-", "_");

    // * run through each config for module
    Object.keys(configuration).forEach((key) => {
      // > things to search for
      // - MODULE_NAME_CONFIG_KEY (module + key, ex: app_NODE_ENV)
      // - CONFIG_KEY (only key, ex: NODE_ENV)
      const noAppPath = `${cleanedProject}_${key}`;
      const search = [noAppPath, key];
      const configPath = `${project}.${key}`;

      // * (preferred) Find an applicable cli switch
      const flag = findKey(search, switchKeys);
      if (flag) {
        const formattedFlag = iSearchKey(flag, switchKeys);
        internal.utils.object.set(
          out,
          configPath,
          parseConfig(configuration[key], CLI_SWITCHES[formattedFlag]),
        );
        logger.trace(
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
      if (!is.empty(environment)) {
        const environmentName = iSearchKey(environment, environmentKeys);
        internal.utils.object.set(
          out,
          configPath,
          parseConfig(configuration[key], env[environmentName]),
        );
        logger.trace(
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
