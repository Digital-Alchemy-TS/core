import { CreateApplication } from "./index.mts";

export const TEST_APPLICATION = CreateApplication({
  name: "test",
  services: {
    Test({ logger }) {
      logger.info("HIT");
    },
  },
});

declare module "./index.mts" {
  export interface LoadedModules {
    test: typeof TEST_APPLICATION;
  }
}

await TEST_APPLICATION.bootstrap({
  //
});
