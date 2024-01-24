import { ZCC, ZCC_Testing } from "@zcc/utilities";

import {
  OptionalModuleConfiguration,
  ServiceMap,
  ZCCApplicationDefinition,
} from "../helpers/index.mjs";
import { TFetch } from "./fetch.extension.mjs";
import { CreateApplication } from "./wiring.extension.mjs";

describe("Fetch Extension", () => {
  let application: ZCCApplicationDefinition<
    ServiceMap,
    OptionalModuleConfiguration
  >;
  let fetch: TFetch;
  // this is primarily to aid in debugging, as the errors get swallowed
  let failFastSpy: jest.SpyInstance;

  beforeEach(async () => {
    failFastSpy = jest
      .spyOn(ZCC_Testing, "FailFast")
      .mockImplementation(() => {});
    application = CreateApplication({
      //
    });
    await application.bootstrap();
    fetch = ZCC.fetch;
  });

  afterEach(async () => {
    if (application) {
      await application.teardown();
      application = undefined;
      ZCC_Testing.WiringReset();
    }
    expect(failFastSpy).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  describe("Fetch Extension Augmentation on ZCC", () => {
    it("should augment ZCC with createFetcher method", () => {
      expect(ZCC.createFetcher).toBeDefined();
      expect(typeof ZCC.createFetcher).toBe("function");
    });

    it("should augment ZCC with fetch method", () => {
      expect(ZCC.fetch).toBeDefined();
      expect(typeof ZCC.fetch).toBe("function");
    });

    // Example test to ensure createFetcher functionality works as expected
    it("createFetcher should initialize fetch functionality correctly", () => {
      const fetcher = ZCC.createFetcher({});
      expect(fetcher).toBeDefined();
      expect(typeof fetcher.fetch).toBe("function");
    });
  });
});
