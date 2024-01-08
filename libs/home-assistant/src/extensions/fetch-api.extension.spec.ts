import { bootTestingModule, ZCCApplicationDefinition } from "@zcc/boilerplate";
import { ZCC } from "@zcc/utilities";

import { LIB_HOME_ASSISTANT } from "../home-assistant.module.mjs";
import { BASE_URL, TOKEN } from "../index.mjs";
import { HAFetchAPI } from "./fetch-api.extension.mjs";

describe("HAFetchAPI", () => {
  let haFetchAPI: ReturnType<typeof HAFetchAPI>;
  let loadedModule: ZCCApplicationDefinition;
  const testBaseUrl = "http://home-assistant.test.local";
  const testToken = "example-token";

  async function createBaseModule() {
    if (loadedModule) {
      ZCC.lifecycle.teardown();
    }
    loadedModule = await bootTestingModule(
      {},
      {
        libs: {
          [LIB_HOME_ASSISTANT.name]: {
            [BASE_URL]: testBaseUrl,
            [TOKEN]: testToken,
          },
        },
      },
    );
    LIB_HOME_ASSISTANT.lifecycle.register();
    await ZCC.lifecycle.exec();
  }

  beforeEach(async () => {
    jest
      .spyOn(LIB_HOME_ASSISTANT, "getConfig")
      .mockImplementation((key: string) => {
        if (key === BASE_URL) return testBaseUrl;
        if (key === TOKEN) return testToken;
        return null;
      });
    haFetchAPI = HAFetchAPI();
    await createBaseModule();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (loadedModule) {
      await ZCC.lifecycle.teardown();
      loadedModule = undefined;
    }
  });

  describe("fetch", () => {
    it("should correctly apply configuration for fetch operation", async () => {
      // Mock implementation for ZCC.fetch.fetch
      jest
        .spyOn(ZCC.fetch, "fetch")
        .mockImplementation(async () => "mock-response");

      const response = await haFetchAPI.fetch({ method: "get", url: "/test" });

      expect(ZCC.fetch.fetch).toHaveBeenCalledWith({
        baseUrl: testBaseUrl,
        headers: { Authorization: `Bearer ${testToken}` },
        method: "get",
        url: "/test",
      });
      expect(response).toBe("mock-response");
    });
  });
});
