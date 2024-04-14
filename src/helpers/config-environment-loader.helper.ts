import minimist from "minimist";

import { is, ServiceMap } from "..";
import {
  AbstractConfig,
  ConfigLoaderParams,
  ConfigLoaderReturn,
  findKey,
  ModuleConfiguration,
} from "./config.helper";

export async function ConfigLoaderEnvironment<
  S extends ServiceMap = ServiceMap,
  C extends ModuleConfiguration = ModuleConfiguration,
>({ configs, internal, logger }: ConfigLoaderParams<S, C>): ConfigLoaderReturn {
  const environmentKeys = Object.keys(process.env);
  const CLI_SWITCHES = minimist(process.argv);
  const switchKeys = Object.keys(CLI_SWITCHES);

  const out: Partial<AbstractConfig> = {};
  configs.forEach((configuration, project) => {
    const cleanedProject = project.replaceAll("-", "_");

    Object.keys(configuration).forEach((key) => {
      const noAppPath = `${cleanedProject}_${key}`;
      const search = [noAppPath, key];
      const configPath = `${project}.${key}`;

      // #MARK: cli switches
      // Find an applicable switch
      const flag = findKey(search, switchKeys);
      if (flag) {
        const formattedFlag = switchKeys.find((key) =>
          search.some((line) =>
            key.match(
              new RegExp(
                `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
                "gi",
              ),
            ),
          ),
        );
        if (is.string(formattedFlag)) {
          internal.utils.object.set(
            out,
            configPath,
            CLI_SWITCHES[formattedFlag],
          );
          logger.trace(
            {
              flag: formattedFlag,
              name: ConfigLoaderEnvironment,
              path: configPath,
            },
            `load config from [cli switch]`,
          );
        }
        return;
      }

      // #MARK: environment variables
      // Find an environment variable
      const environment = findKey(search, environmentKeys);
      if (is.empty(environment)) {
        return;
      }
      const environmentName = environmentKeys.find((key) =>
        search.some((line) =>
          key.match(
            new RegExp(
              `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
              "gi",
            ),
          ),
        ),
      );
      if (is.string(environmentName)) {
        internal.utils.object.set(
          out,
          configPath,
          process.env[environmentName],
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
