import minimist from "minimist";
import { set } from "object-path";

import { is } from "../..";
import {
  AbstractConfig,
  ConfigLoaderReturn,
  KnownConfigs,
  OptionalModuleConfiguration,
} from "./config.helper";
import { ServiceMap, ZCCApplicationDefinition } from "./wiring.helper";

export async function ConfigLoaderEnvironment(
  application: ZCCApplicationDefinition<
    ServiceMap,
    OptionalModuleConfiguration
  >,
  configs: KnownConfigs,
): ConfigLoaderReturn {
  const environmentKeys = Object.keys(process.env);
  const CLI_SWITCHES = minimist(process.argv);
  const switchKeys = Object.keys(CLI_SWITCHES);

  const out: Partial<AbstractConfig> = {};
  configs.forEach((configuration, project) => {
    const isApplication = !is.string(project);
    const cleanedProject =
      (isApplication ? application.name : project)?.replaceAll("-", "_") ||
      "unknown";
    const environmentPrefix = isApplication
      ? "application"
      : `libs_${cleanedProject}`;
    const configPrefix = isApplication ? "application" : `libs.${project}`;

    Object.keys(configuration).forEach(key => {
      const noAppPath = `${environmentPrefix}_${key}`;
      const search = [noAppPath, key];
      const configPath = `${configPrefix}.${key}`;

      // Find an applicable switch
      const flag =
        // Find an exact match (if available) first
        search.find(line => switchKeys.includes(line)) ||
        // Do case insensitive searches
        search.find(line => {
          const match = new RegExp(
            `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
            "gi",
          );
          return switchKeys.some(item => item.match(match));
        });
      if (flag) {
        const formattedFlag = switchKeys.find(key =>
          search.some(line =>
            key.match(
              new RegExp(
                `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
                "gi",
              ),
            ),
          ),
        );
        if (is.string(formattedFlag)) {
          set(out, configPath, CLI_SWITCHES[formattedFlag]);
        }
        return;
      }
      // Find an environment variable
      const environment =
        // Find an exact match (if available) first
        search.find(line => environmentKeys.includes(line)) ||
        // Do case insensitive searches
        search.find(line => {
          const match = new RegExp(
            `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
            "gi",
          );
          return environmentKeys.some(item => item.match(match));
        });
      if (is.empty(environment)) {
        return;
      }
      const environmentName = environmentKeys.find(key =>
        search.some(line =>
          key.match(
            new RegExp(
              `^${line.replaceAll(new RegExp("[-_]", "gi"), "[-_]?")}$`,
              "gi",
            ),
          ),
        ),
      );
      if (is.string(environmentName)) {
        set(out, configPath, process.env[environmentName]);
      }
    });
  });
  return out;
}
