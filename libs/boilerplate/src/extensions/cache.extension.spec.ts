import { ZCC } from "@zcc/utilities";

import { ZCCApplicationDefinition } from "../helpers/wiring.helper.mjs";
import { TCache } from "./cache.extension.mjs";
import { CreateApplication, TEST_WIRING } from "./wiring.extension.mjs";

describe("Cache Extension", () => {
  let application: ZCCApplicationDefinition;
  let cache: TCache;
  // this is primarily to aid in debugging, as the errors get swallowed
  let failFastSpy: jest.SpyInstance;

  beforeEach(async () => {
    failFastSpy = jest
      .spyOn(TEST_WIRING, "FailFast")
      .mockImplementation(() => {});
    application = CreateApplication({
      //
    });
    await application.bootstrap();
    cache = ZCC.cache;
  });

  afterEach(async () => {
    if (application) {
      await application.teardown();
      application = undefined;
      TEST_WIRING.testing.Reset();
    }
    expect(failFastSpy).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  describe("set Method", () => {
    it("should successfully set a value in the cache", async () => {
      const key = "testKey";
      const value = "testValue";
      await cache.set(key, value);
      const result = await cache.get(key);
      expect(result).toEqual(value);
    });

    it("should overwrite existing value with the same key", async () => {
      const key = "testKey";
      const value1 = "value1";
      const value2 = "value2";
      await cache.set(key, value1);
      await cache.set(key, value2);
      const result = await cache.get(key);
      expect(result).toEqual(value2);
    });

    it("should respect the TTL for a cached item", async () => {
      const key = "tempKey";
      const value = "tempValue";
      const ttl = 1; // Time-to-live in seconds
      await cache.set(key, value, ttl);
      // Wait for the TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      const result = await cache.get(key);
      expect(result).toBeUndefined();
    });
  });

  describe("get Method", () => {
    it("should retrieve the correct value for an existing key", async () => {
      const key = "existingKey";
      const expectedValue = "storedValue";
      await cache.set(key, expectedValue);
      const result = await cache.get(key);
      expect(result).toEqual(expectedValue);
    });

    it("should return the default value for a non-existing key", async () => {
      const defaultValue = "default";
      const result = await cache.get("nonExistingKey", defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it("should return undefined for a non-existing key when no default value is provided", async () => {
      const result = await cache.get("nonExistingKey");
      expect(result).toBeUndefined();
    });

    it("should handle different types for the default value", async () => {
      const key = "nonExistingKey";
      const defaultValue = 123;
      const result = await cache.get(key, defaultValue);
      expect(result).toBe(defaultValue);
    });
    const defaultValue = "defaultValue";

    it("should return the actual value when it is false", async () => {
      const key = "keyWithFalse";
      const falseValue = false;
      await cache.set(key, falseValue);
      const result = await cache.get(key, defaultValue);
      expect(result).toBe(falseValue);
    });

    it("should return the actual value when it is 0", async () => {
      const key = "keyWithZero";
      const zeroValue = 0;
      await cache.set(key, zeroValue);
      const result = await cache.get(key, defaultValue);
      expect(result).toBe(zeroValue);
    });

    it("should return the actual value when it is an empty string", async () => {
      const key = "keyWithEmptyString";
      const emptyStringValue = "";
      await cache.set(key, emptyStringValue);
      const result = await cache.get(key, defaultValue);
      expect(result).toBe(emptyStringValue);
    });

    it("should return the actual value when it is null", async () => {
      const key = "keyWithNull";
      const nullValue = null;
      await cache.set(key, nullValue);
      const result = await cache.get(key, defaultValue);
      expect(result).toBe(nullValue);
    });

    it("should return the default value for a key that is not set in the cache (undefined)", async () => {
      const key = "keyNotSet";
      const defaultValue = "defaultValue";
      // No value is set for 'keyNotSet'
      const result = await cache.get(key, defaultValue);
      expect(result).toEqual(defaultValue); // Expecting the default value as the key is not set in the cache
    });
  });
});
