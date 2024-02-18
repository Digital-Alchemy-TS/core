import { ZCC, ZCC_Testing } from "../..";
import {
  ModuleConfiguration,
  OptionalModuleConfiguration,
  ServiceMap,
  ZCCApplicationDefinition,
  ZCCLibraryDefinition,
} from "..";
import { CreateApplication, TFetch } from ".";

describe("Fetch", () => {
  let application: ZCCApplicationDefinition<
    ServiceMap,
    OptionalModuleConfiguration
  >;
  let fetch: TFetch;
  let failFastSpy: jest.SpyInstance;

  afterEach(async () => {
    if (application) {
      if (application.booted) {
        await application.teardown();
      }
      application = undefined;
    }
    jest.restoreAllMocks();
    ZCC_Testing.WiringReset();
  });

  beforeEach(async () => {
    failFastSpy = jest
      .spyOn(ZCC_Testing, "FailFast")
      .mockImplementation(() => {});
    application = CreateApplication({
      name: "testing_app",
      services: {},
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
    if (fetch) {
      fetch = undefined;
    }
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

declare module ".." {
  export interface LoadedModules {
    testing_app: ZCCApplicationDefinition<ServiceMap, ModuleConfiguration>;
    testing: ZCCLibraryDefinition<ServiceMap, ModuleConfiguration>;
    testing_second: ZCCLibraryDefinition<ServiceMap, ModuleConfiguration>;
  }
}
