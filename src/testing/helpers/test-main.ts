// magic import, don't touch
import "../..";

import { CreateApplication } from "../../extensions";
import { InternalConfig, TServiceParams } from "../../helpers";

type InternalData = {
  foo: string;
  bar: string;
  test: boolean;
};

export const HOME_AUTOMATION = CreateApplication({
  configuration: {
    TEST_OBJECT_CONFIG: {
      default: {
        bar: "no",
        foo: "yes",
        test: false,
      },
      type: "internal",
    } satisfies InternalConfig<InternalData>,
  },
  // @ts-expect-error test
  name: "test",
  services: {
    Test({ logger, config, lifecycle }: TServiceParams) {
      lifecycle.onReady(() => {
        // @ts-expect-error test
        logger.warn({ config: config.test });
      });
    },
  },
});

setImmediate(async () => {
  await HOME_AUTOMATION.bootstrap({
    // bootLibrariesFirst: true,
    configuration: {
      //
    },
    // showExtraBootStats: true,
  });
});
