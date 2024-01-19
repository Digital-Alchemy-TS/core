import { CreateApplication, ZCCApplicationDefinition } from "@zcc/boilerplate";
import { ZCC, ZCC_Testing } from "@zcc/utilities";

import { LIB_HOME_ASSISTANT } from "../home-assistant.module.mjs";
import { THAFetchAPI } from "./fetch-api.extension.mjs";

describe("Fetch Extension", () => {
  let application: ZCCApplicationDefinition;
  let fetch: THAFetchAPI;
  // this is primarily to aid in debugging, as the errors get swallowed
  let failFastSpy: jest.SpyInstance;

  beforeEach(async () => {
    failFastSpy = jest
      .spyOn(ZCC_Testing, "FailFast")
      .mockImplementation(() => {});
    application = CreateApplication({
      libraries: [LIB_HOME_ASSISTANT],
    });
    await application.bootstrap();
    fetch = ZCC.hass.fetch;
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

  describe("Sanity Checks for ZCC.hass.fetch", () => {
    it("should have ZCC.hass.fetch defined with all expected functions", () => {
      expect(ZCC.hass.fetch).toBeDefined();

      const expectedFunctions = [
        "calendarSearch",
        "callService",
        "checkConfig",
        "fetchEntityCustomizations",
        "fetchEntityHistory",
        "fireEvent",
        "getAllEntities",
        "getConfig",
        "getLogs",
        "getRawLogs",
        "listServices",
        "updateEntity",
        "webhook",
      ];

      expectedFunctions.forEach(function_ => {
        expect(typeof ZCC.hass.fetch[function_]).toBe("function");
      });
    });
  });
});
