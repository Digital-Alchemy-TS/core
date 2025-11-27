import { ServiceRunner } from "../../src/index.mts";

await ServiceRunner(
  {
    configuration: {
      NOT_PROVIDED: {
        required: true,
        type: "string",
      },
    },
  },
  ({ logger }) => {
    logger.info("this should not be seen");
  },
);
