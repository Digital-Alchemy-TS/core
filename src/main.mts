import { CreateApplication } from "./index.mjs";

export const TEST_APPLICATION = CreateApplication({
  name: "test",
  services: {
    Test({ logger }) {
      logger.info("HIT");
    },
  },
});

declare module "./index.mjs" {
  export interface LoadedModules {
    test: typeof TEST_APPLICATION;
  }
}

await TEST_APPLICATION.bootstrap({
  //
});
