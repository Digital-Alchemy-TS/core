import { is, ZCC } from "@zcc/utilities";

import { createMemoryDriver } from "../helpers/cache-memory.helper.mjs";
import { createRedisDriver } from "../helpers/cache-redis.helper.mjs";
import {
  CACHE_PREFIX,
  CACHE_PROVIDER,
  CACHE_TTL,
} from "../helpers/config.constants.mjs";
import {
  CACHE_DELETE_OPERATIONS_TOTAL,
  CACHE_DRIVER_ERROR_COUNT,
  CACHE_GET_OPERATIONS_TOTAL,
  CACHE_SET_OPERATIONS_TOTAL,
} from "../helpers/metrics.helper.mjs";
import { TServiceParams } from "../helpers/wiring.helper.mjs";

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

export function ZCC_Cache({
  logger,
  getConfig,
  lifecycle,
}: TServiceParams): TCache {
  let prefix: string = "";
  let DEFAULT_TTL: number;
  let provider: `${CacheProviders}`;
  let client: ICacheDriver;

  function fullKeyName(key: string): string {
    return `${prefix}${key}`;
  }

  lifecycle.onPostConfig(() => {
    prefix = getConfig(CACHE_PREFIX);
    DEFAULT_TTL = getConfig(CACHE_TTL);
    provider = getConfig(CACHE_PROVIDER);
    logger.trace(
      {
        prefix,
        provider,
        ttl: DEFAULT_TTL,
      },
      `Configure cache`,
    );
    if (client) {
      return;
    }
    logger.trace({ provider }, `Init cache`);
    if (provider === "redis") {
      client = createRedisDriver({ getConfig, logger });
      return;
    }
    client = createMemoryDriver({ getConfig, logger });
  });

  const cache: TCache = {
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
    get: async <T,>(key: string, defaultValue?: T): Promise<T> => {
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
    keys: async (pattern?: string): Promise<string[]> => {
      try {
        return await client.keys(fullKeyName(pattern || "*"));
      } catch (error) {
        CACHE_DRIVER_ERROR_COUNT.labels("keys").inc();
        logger.warn({ error }, `Cache keys error`);
        return [];
      }
    },
    set: async <T,>(
      key: string,
      value: T,
      ttl = DEFAULT_TTL,
    ): Promise<void> => {
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
  };
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
