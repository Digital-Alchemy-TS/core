import { ServiceRunner } from "../../src/index.mts";

await ServiceRunner({}, ({ logger, lifecycle }) => {
  lifecycle.onReady(() => logger.info("this should be seen"));
});
