/**
 * Minimal single-service bootstrap helper for scripts and one-off operations.
 *
 * @remarks
 * `ServiceRunner` creates a complete DI graph for a single service, handling
 * all wiring, lifecycle, and teardown. It is useful for scripts that need
 * access to the full framework without building an application. The service
 * function receives the same `TServiceParams` as a normal service, allowing
 * access to config, logger, scheduler, and other boilerplate.
 */

import { CreateApplication } from "../index.mts";
import type { OptionalModuleConfiguration } from "./config.mts";
import type {
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
 * Bootstrap and run a single typed service with full framework support.
 *
 * @remarks
 * Creates an application with a single service, invokes its bootstrap lifecycle,
 * and returns when the service completes. The service runs synchronously within
 * the context of a fully-initialized DI graph, with access to all boilerplate
 * services (logger, scheduler, lifecycle, config, etc.).
 *
 * @example
 * ```typescript
 * await ServiceRunner(
 *   { configuration: { myLib: {...} } },
 *   ({ logger, config }) => {
 *     logger.info("running with config:", config.myLib);
 *   }
 * );
 * ```
 */
export async function ServiceRunner<
  C extends OptionalModuleConfiguration,
  NAME extends string = "dynamic",
>(
  { bootstrap, ...config }: ServiceRunnerConfiguration<C, NAME> & { bootstrap?: BootstrapOptions },
  service: (params: LocalServiceParams<C, NAME>) => void | Promise<void>,
): Promise<void> {
  await CreateApplication({
    // @ts-expect-error necessary evil for this type loosening
    name: "dynamic",
    // config will override default name
    ...config,
    services: {
      service: service as ServiceFunction,
    },
  }).bootstrap(bootstrap);
}
