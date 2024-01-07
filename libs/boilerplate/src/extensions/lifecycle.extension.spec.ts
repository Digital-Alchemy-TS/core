import { ZCC } from "@zcc/utilities";

import { LIB_BOILERPLATE } from "../boilerplate.module.mjs";
import { TChildLifecycle } from "../helpers/lifecycle.helper.mjs";
import { bootTestingModule } from "../helpers/testing.helper.mjs";
import { ZCCApplicationDefinition } from "./application.extension.mjs";

describe("Lifecycle Extension Tests", () => {
  let loadedModule: ZCCApplicationDefinition;
  const attachMethods = [
    "onBootstrap",
    // "onConfig",
    // "onPostConfig",
    // "onPreInit",
    // "onReady",
  ];

  async function createBaseModule() {
    if (loadedModule) {
      ZCC.lifecycle.teardown();
    }
    loadedModule = await bootTestingModule({}, { libs: {} });
    LIB_BOILERPLATE.lifecycle.register();
  }

  beforeAll(async () => {
    await createBaseModule();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (loadedModule) {
      await ZCC.lifecycle.teardown();
      loadedModule = undefined;
    }
  });

  it("Lifecycle stages should be callable", async () => {
    expect(typeof ZCC.lifecycle.onBootstrap).toBe("function");
    expect(typeof ZCC.lifecycle.onConfig).toBe("function");
    expect(typeof ZCC.lifecycle.onPostConfig).toBe("function");
    expect(typeof ZCC.lifecycle.onPreInit).toBe("function");
    expect(typeof ZCC.lifecycle.onReady).toBe("function");
    expect(typeof ZCC.lifecycle.init).toBe("function");
    expect(typeof ZCC.lifecycle.teardown).toBe("function");
    expect(typeof ZCC.lifecycle.child).toBe("function");
  });

  it("Callbacks in each lifecycle stage should be executed in the correct order", async () => {
    const executionOrder = [];
    const mockCallbackFactory = name =>
      jest.fn(() => {
        executionOrder.push(name);
      });

    const mockPreInit = mockCallbackFactory("onPreInit");
    const mockConfig = mockCallbackFactory("onConfig");
    const mockPostConfig = mockCallbackFactory("onPostConfig");
    const mockBootstrap = mockCallbackFactory("onBootstrap");
    const mockReady = mockCallbackFactory("onReady");

    ZCC.lifecycle.onPreInit(mockPreInit);
    ZCC.lifecycle.onConfig(mockConfig);
    ZCC.lifecycle.onPostConfig(mockPostConfig);
    ZCC.lifecycle.onBootstrap(mockBootstrap);
    ZCC.lifecycle.onReady(mockReady);

    await createBaseModule();
    await ZCC.lifecycle.exec();

    // Verify that each callback was called once
    expect(mockPreInit).toHaveBeenCalledTimes(1);
    expect(mockConfig).toHaveBeenCalledTimes(1);
    expect(mockPostConfig).toHaveBeenCalledTimes(1);
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    expect(mockReady).toHaveBeenCalledTimes(1);

    // Verify the order of execution
    expect(executionOrder).toEqual([
      "onPreInit",
      "onConfig",
      "onPostConfig",
      "onBootstrap",
      "onReady",
    ]);
  });

  describe.only("Late Attach Callback Execution for All Methods", () => {
    let mockWarn;
    let mockCallback;

    beforeEach(() => {
      mockWarn = jest.spyOn(ZCC.systemLogger, "warn").mockImplementation();
      mockCallback = jest.fn();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    async function testLateAttach(methodName, lifecycleMethod) {
      await createBaseModule();
      await ZCC.lifecycle.exec();

      lifecycleMethod(mockCallback);

      await new Promise(setImmediate);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockWarn).toHaveBeenCalledWith(`[${methodName}] late attach`);
    }

    attachMethods.forEach(method => {
      it(`${method} should execute callback immediately if added after exec`, async () => {
        await testLateAttach(method, ZCC.lifecycle[method]);
      });
    });
  });

  describe("Child Lifecycle Event Chaining", () => {
    let childLifecycle: TChildLifecycle;
    let mockParentCallback, mockChildCallback;

    beforeEach(async () => {
      childLifecycle = ZCC.lifecycle.child();
      await childLifecycle.register();
      mockParentCallback = jest.fn();
      mockChildCallback = jest.fn();
    });

    afterEach(async () => {
      jest.clearAllMocks();
      await ZCC.lifecycle.teardown();
    });

    attachMethods.forEach(method => {
      it(`${method} should be called for both parent and child at exec`, async () => {
        ZCC.lifecycle[method](mockParentCallback);
        childLifecycle[method](mockChildCallback);
        await createBaseModule();
        await ZCC.lifecycle.exec();

        expect(mockParentCallback).toHaveBeenCalledTimes(1);
        expect(mockChildCallback).toHaveBeenCalledTimes(1);
      });
    });
  });
});
