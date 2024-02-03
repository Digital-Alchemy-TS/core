import { is, NONE, ZCC } from "@zcc/utilities";

import {
  CACHE_DELETE_OPERATIONS_TOTAL,
  CACHE_DRIVER_ERROR_COUNT,
  CACHE_GET_OPERATIONS_TOTAL,
  CACHE_SET_OPERATIONS_TOTAL,
  createMemoryDriver,
  createRedisDriver,
  TServiceParams,
} from "../helpers/index";
import { LIB_BOILERPLATE } from "./wiring.extension";

export interface ICacheDriver {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

export enum CacheProviders {
  redis = "redis",
  memory = "memory",
}

export function ZCC_Cache({ logger, lifecycle }: TServiceParams): TCache {
  let prefix = "";
  let defaultTtl: number;
  let provider: `${CacheProviders}`;
  let client: ICacheDriver;

  function fullKeyName(key: string): string {
    return `${prefix}${key}`;
  }

  lifecycle.onPostConfig(() => {
    prefix = LIB_BOILERPLATE.getConfig("CACHE_PREFIX") || "";
    defaultTtl = LIB_BOILERPLATE.getConfig("CACHE_TTL");
    provider = LIB_BOILERPLATE.getConfig("CACHE_PROVIDER") as CacheProviders;
    logger.trace(
      {
        prefix,
        provider,
        ttl: defaultTtl,
      },
      `Configure cache`,
    );
    if (client) {
      return;
    }
    logger.trace({ provider }, `Init cache`);
    if (provider === "redis") {
      client = createRedisDriver({ logger });
      return;
    }
    client = createMemoryDriver({ logger });
  });

  const cache = {
    [Symbol.for("cache_logger")]: logger,
    del: async (key: string): Promise<void> => {
      try {
        const fullKey = fullKeyName(key);
        await client.del(fullKey);
        CACHE_DELETE_OPERATIONS_TOTAL.inc({
          key: fullKey,
          prefix,
        });
      } catch (error) {
        CACHE_DRIVER_ERROR_COUNT.labels("del").inc();
        logger.error({ error }, `Cache delete error`);
      }
    },
    get: async <T>(key: string, defaultValue?: T): Promise<T> => {
      try {
        const fullKey = fullKeyName(key);
        const result = await client.get(fullKey);
        CACHE_GET_OPERATIONS_TOTAL.inc({
          hit_miss: is.undefined(result) ? "miss" : "hit",
          key: fullKey,
          prefix,
        });
        return is.undefined(result) ? defaultValue : (result as T);
      } catch (error) {
        logger.warn({ defaultValue, error, key }, `Cache lookup error`);
        CACHE_DRIVER_ERROR_COUNT.labels("get").inc();
        return defaultValue;
      }
    },
    keys: async (pattern = ""): Promise<string[]> => {
      try {
        const fullPattern = fullKeyName(pattern);
        const keys = await client.keys(fullPattern);
        return keys.map(key => key.slice(Math.max(NONE, prefix.length)));
      } catch (error) {
        CACHE_DRIVER_ERROR_COUNT.labels("keys").inc();
        logger.warn({ error }, `Cache keys error`);
        return [];
      }
    },
    set: async <T>(key: string, value: T, ttl = defaultTtl): Promise<void> => {
      try {
        const fullKey = fullKeyName(key);
        await client.set(fullKey, value, ttl);
        CACHE_SET_OPERATIONS_TOTAL.inc({
          key: fullKey,
          prefix,
        });
      } catch (error) {
        CACHE_DRIVER_ERROR_COUNT.labels("set").inc();
        logger.error({ error }, `Cache set error`);
      }
    },
    setClient: newClient => {
      logger.debug(`Using new cache driver`);
      client = newClient;
    },
  } as TCache;
  ZCC.cache = cache;
  return cache;
}

export type TCache = {
  del: (key: string) => Promise<void>;
  get: <T>(key: string, defaultValue?: T) => Promise<T>;
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
  keys: (pattern?: string) => Promise<string[]>;
  setClient: (client: ICacheDriver) => void;
};

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    cache: TCache;
  }
}