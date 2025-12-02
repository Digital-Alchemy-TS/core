import { ServiceRunner } from "../../src/index.mts";

await ServiceRunner(
  {
    bootstrap: {
      showExtraBootStats: true,
    },
  },
  ({ logger, lifecycle }) => {
    lifecycle.onReady(() => logger.info("this should be seen"));
  },
);
