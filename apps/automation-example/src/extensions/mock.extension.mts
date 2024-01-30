import { TServiceParams } from "@zcc/boilerplate";

// This file exists to describe functionality that is implemented in the real system, but doesn't need an implementation / out of scope for this repo
export function MockExtension({ logger }: TServiceParams) {
  return {
    findPhone() {
      logger.info(`Sending request to kde connect to ring phone`);
    },
  };
}
