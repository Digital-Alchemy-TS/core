import { CreateApplication, TServiceParams } from "..";
import { TestRunner } from "./helpers";
import { BASIC_BOOT } from "./testing.helper";

describe("Scheduler", () => {
  beforeAll(async () => {
    // @ts-expect-error testing
    const preload = CreateApplication({ name: "testing" });
    await preload.bootstrap(BASIC_BOOT);
    await preload.teardown();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("cron", () => {
    it("works", async () => {
      let params: TServiceParams;
      const app = await TestRunner().run((options) => {
        params = options;
      });

      await app.teardown();
    });
  });
});
