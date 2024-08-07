import { CreateApplication } from "../extensions";
import { BootstrapOptions, TBlackHole, TServiceParams } from "../helpers";

export const BASIC_BOOT = {
  configuration: { boilerplate: { LOG_LEVEL: "silent" } },
} as BootstrapOptions;

export async function ServiceTest(
  callback: (params: TServiceParams) => TBlackHole,
  options: BootstrapOptions = BASIC_BOOT,
) {
  const application = CreateApplication({
    configurationLoaders: [],
    // @ts-expect-error testing
    name: "testing",
    services: {
      async Testing(params: TServiceParams) {
        await callback(params);
        const { metrics } = params.internal.boilerplate;
        const keys = Object.keys(metrics) as (keyof typeof metrics)[];
        keys.forEach((key) => metrics[key].reset());
      },
    },
  });
  await application.bootstrap(options);
  await application.teardown();
}
