import {
  CACHE_DELETE_OPERATIONS_TOTAL,
  CACHE_GET_OPERATIONS_TOTAL,
  CACHE_SET_OPERATIONS_TOTAL,
  CreateApplication,
} from "..";
import { BASIC_BOOT, ServiceTest } from "./testing.helper";

describe("Cache Extension", () => {
  // * DO NOT REMOVE THIS BLOCK
  beforeAll(async () => {
    // It does nothing, but somehow magically prevents jest from exploding for no reason
    // @ts-expect-error asdf
    const preload = CreateApplication({ name: "testing" });
    await preload.bootstrap(BASIC_BOOT);
    await preload.teardown();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("set Method", () => {
    it("should successfully set a value in the cache", async () => {
      expect.assertions(1);

      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "testKey";
          const value = "testValue";
          await cache.set(key, value);
          const result = await cache.get(key);
          expect(result).toEqual(value);
        });
      });
    });

    it("should overwrite existing value with the same key", async () => {
      expect.assertions(1);

      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "testKey";
          const value1 = "value1";
          const value2 = "value2";
          await cache.set(key, value1);
          await cache.set(key, value2);
          const result = await cache.get(key);
          expect(result).toEqual(value2);
        });
      });
    });

    it("should respect the TTL for a cached item", async () => {
      expect.assertions(1);

      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "tempKey";
          const value = "tempValue";
          const ttl = 1; // Time-to-live in seconds
          await cache.set(key, value, ttl);
          // Wait for the TTL to expire
          await new Promise((resolve) => setTimeout(resolve, 1100));
          const result = await cache.get(key);
          expect(result).toBeUndefined();
        });
      });
    });
  });

  describe("get Method", () => {
    it("should retrieve the correct value for an existing key", async () => {
      expect.assertions(1);

      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "existingKey";
          const expectedValue = "storedValue";
          await cache.set(key, expectedValue);
          const result = await cache.get(key);
          expect(result).toEqual(expectedValue);
        });
      });
    });

    it("should return the default value for a non-existing key", async () => {
      expect.assertions(1);

      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const defaultValue = "default";
          const result = await cache.get("nonExistingKey", defaultValue);
          expect(result).toEqual(defaultValue);
        });
      });
    });

    it("should return undefined for a non-existing key when no default value is provided", async () => {
      expect.assertions(1);

      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const result = await cache.get("nonExistingKey");
          expect(result).toBeUndefined();
        });
      });
    });

    it("should handle different types for the default value", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "nonExistingKey";
          const defaultValue = 123;
          const result = await cache.get(key, defaultValue);
          expect(result).toBe(defaultValue);
        });
      });
    });
    const defaultValue = "defaultValue";

    it("should return the actual value when it is false", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "keyWithFalse";
          const falseValue = false;
          await cache.set(key, falseValue);
          const result = await cache.get(key, defaultValue);
          expect(result).toBe(falseValue);
        });
      });
    });

    it("should return the actual value when it is 0", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "keyWithZero";
          const zeroValue = 0;
          await cache.set(key, zeroValue);
          const result = await cache.get(key, defaultValue);
          expect(result).toBe(zeroValue);
        });
      });
    });

    it("should return the actual value when it is an empty string", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "keyWithEmptyString";
          const emptyStringValue = "";
          await cache.set(key, emptyStringValue);
          const result = await cache.get(key, defaultValue);
          expect(result).toBe(emptyStringValue);
        });
      });
    });

    it("should return the actual value when it is null", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "keyWithNull";
          const nullValue = null as null;
          await cache.set(key, nullValue);
          const result = await cache.get(key, defaultValue);
          expect(result).toBe(nullValue);
        });
      });
    });

    it("should return the default value for a key that is not set in the cache (undefined)", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "keyNotSet";
          const defaultValue = "defaultValue";
          // No value is set for 'keyNotSet'
          const result = await cache.get(key, defaultValue);
          expect(result).toEqual(defaultValue); // Expecting the default value as the key is not set in the cache});
        });
      });
    });

    it.skip("should return the default value for a non-existing key, regardless of its type", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const defaultStringValue = "defaultString";
          const defaultNumberValue = 42;
          const defaultObjectValue = { default: "object" };

          const resultString = await cache.get(
            "nonExistingStringKey",
            defaultStringValue,
          );
          const resultNumber = await cache.get(
            "nonExistingNumberKey",
            defaultNumberValue,
          );
          const resultObject = await cache.get(
            "nonExistingObjectKey",
            defaultObjectValue,
          );

          expect(resultString).toEqual(defaultStringValue);
          expect(resultNumber).toEqual(defaultNumberValue);
          expect(resultObject).toEqual(defaultObjectValue);
        });
      });
    });
  });

  describe("del Method", () => {
    it("should successfully delete an existing key from the cache", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const key = "keyToDelete";
          await cache.set(key, "value");
          await cache.del(key);
          const result = await cache.get(key);
          expect(result).toBeUndefined();
        });
      });
    });

    it.skip("should confirm that a non-existing key is not in the cache after a delete operation", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const nonExistingKey = "nonExistingKey";
          // Initial check to confirm the key is not already in the cache
          const initialResult = await cache.get(nonExistingKey);
          expect(initialResult).toBeUndefined();

          await cache.del(nonExistingKey);
          // Recheck to confirm the key is still not in the cache
          const finalResult = await cache.get(nonExistingKey);
          expect(finalResult).toBeUndefined();
        });
      });
    });

    it("should handle deletion of a key with a falsey value correctly", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          const falseyKey = "falseyKey";
          await cache.set(falseyKey, 0); // Or other falsey values like '', false, null
          await cache.del(falseyKey);
          const result = await cache.get(falseyKey);
          expect(result).toBeUndefined();
        });
      });
    });
  });

  describe.skip("keys Method", () => {
    it("should return all keys in the cache when no pattern is provided", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          // Setting up multiple keys in the cache
          await cache.set("key1", "value1");
          await cache.set("key2", "value2");
          await cache.set("key3", "value3");

          const allKeys = await cache.keys();
          expect(allKeys).toContain("key1");
          expect(allKeys).toContain("key2");
          expect(allKeys).toContain("key3");
        });
      });
    });

    it("should return keys matching a specific pattern", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          // Setting up keys, some of which match a pattern
          await cache.set("match1", "value1");
          await cache.set("match2", "value2");
          await cache.set("noMatch", "value3");

          const matchedKeys = await cache.keys("match*");
          expect(matchedKeys).toContain("match1");
          expect(matchedKeys).toContain("match2");
          expect(matchedKeys).not.toContain("noMatch");
        });
      });
    });

    it("should return an empty array if no keys match the pattern", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          // Assuming the cache is clear or the pattern is very unique
          const noMatchKeys = await cache.keys("nonExistentPattern*");
          expect(noMatchKeys).toEqual([]);
        });
      });
    });
  });

  describe("Cache Operation Metrics", () => {
    beforeEach(async () => {
      // Resetting metrics before each test
      await CACHE_DELETE_OPERATIONS_TOTAL.reset();
      await CACHE_GET_OPERATIONS_TOTAL.reset();
      await CACHE_SET_OPERATIONS_TOTAL.reset();
    });

    it("should increment CACHE_SET_OPERATIONS_TOTAL on set operations", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          await cache.set("testKey", "testValue");
          const newCount = (await CACHE_SET_OPERATIONS_TOTAL.get()).values[0]
            .value;
          expect(newCount).toBe(1);
        });
      });
    });

    it("should increment CACHE_GET_OPERATIONS_TOTAL on get operations", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          await cache.get("testKey");
          const newCount = (await CACHE_GET_OPERATIONS_TOTAL.get()).values[0]
            .value;
          expect(newCount).toBe(1);
        });
      });
    });

    it("should increment CACHE_DELETE_OPERATIONS_TOTAL on delete operations", async () => {
      expect.assertions(1);
      await ServiceTest(({ cache, lifecycle }) => {
        lifecycle.onReady(async () => {
          await cache.del("testKey");
          const newCount = (await CACHE_DELETE_OPERATIONS_TOTAL.get()).values[0]
            .value;
          expect(newCount).toBe(1);
        });
      });
    });
  });
});
