import { BootstrapException, ServiceRunner } from "../../src/index.mts";

await ServiceRunner({}, ({ logger, lifecycle, context }) => {
  lifecycle.onReady(() => logger.info("this should not be seen"));
  lifecycle.onPostConfig(() => {
    throw new BootstrapException(context, "BOOM", "should stop bootstrap");
  });
});
