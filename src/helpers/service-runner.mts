import { CreateApplication } from "../index.mts";
import { OptionalModuleConfiguration } from "./config.mts";
import {
  ApplicationConfigurationOptions,
  BootstrapOptions,
  ConfigTypes,
  ServiceFunction,
  ServiceMap,
  TInjectedConfig,
  TServiceParams,
} from "./wiring.mts";

type ServiceRunnerConfiguration<C extends OptionalModuleConfiguration, NAME extends string> = Omit<
  ApplicationConfigurationOptions<ServiceMap, C>,
  "services" | "name" | "priorityInit"
> & { name?: NAME };

type LocalServiceParams<C extends OptionalModuleConfiguration, NAME extends string> = Omit<
  TServiceParams,
  "config"
> & {
  config: TInjectedConfig & Record<NAME, ConfigTypes<C>>;
};

/**
 * Type safe way to kick off a mini service / script
 */
export async function ServiceRunner<
  C extends OptionalModuleConfiguration,
  NAME extends string = "dynamic",
>(
  { bootstrap, ...config }: ServiceRunnerConfiguration<C, NAME> & { bootstrap?: BootstrapOptions },
  service: (params: LocalServiceParams<C, NAME>) => void | Promise<void>,
): Promise<void> {
  await CreateApplication({
    // @ts-expect-error loosen this up
    name: "dynamic",
    ...config,
    services: {
      service: service as ServiceFunction,
    },
  }).bootstrap(bootstrap);
}
