import { is, NONE, ZCC } from "../..";
import {
  CACHE_DELETE_OPERATIONS_TOTAL,
  CACHE_DRIVER_ERROR_COUNT,
  CACHE_GET_OPERATIONS_TOTAL,
  CACHE_SET_OPERATIONS_TOTAL,
  createMemoryDriver,
  createRedisDriver,
  TServiceParams,
} from "..";

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
  lifecycle,
  config,
}: TServiceParams): TCache {
  let client: ICacheDriver;
  const prefix = () => config.boilerplate.CACHE_PREFIX || ZCC.application.name;

  function fullKeyName(key: string): string {
    return `${config.boilerplate.CACHE_PREFIX}${key}`;
  }

  lifecycle.onPostConfig(async () => {
    if (client) {
      return;
    }
    logger.trace({ provider: config.boilerplate.CACHE_PROVIDER }, `init cache`);
    if (config.boilerplate.CACHE_PROVIDER === "redis") {
      client = await createRedisDriver({ config, logger });
      return;
    }
    client = await createMemoryDriver({ config, logger });
  });

  const cache = {
    [Symbol.for("cache_logger")]: logger,
    del: async (key: string): Promise<void> => {
      try {
        const fullKey = fullKeyName(key);
        await client.del(fullKey);
        CACHE_DELETE_OPERATIONS_TOTAL.inc({
          key: fullKey,
          prefix: prefix(),
        });
      } catch (error) {
        CACHE_DRIVER_ERROR_COUNT.labels("del").inc();
        logger.error({ error }, `cache delete error`);
      }
    },
    get: async <T>(key: string, defaultValue?: T): Promise<T> => {
      try {
        const fullKey = fullKeyName(key);
        const result = await client.get(fullKey);
        CACHE_GET_OPERATIONS_TOTAL.inc({
          hit_miss: is.undefined(result) ? "miss" : "hit",
          key: fullKey,
          prefix: prefix(),
        });
        return is.undefined(result) ? defaultValue : (result as T);
      } catch (error) {
        logger.warn({ defaultValue, error, key }, `cache lookup error`);
        CACHE_DRIVER_ERROR_COUNT.labels("get").inc();
        return defaultValue;
      }
    },
    keys: async (pattern = ""): Promise<string[]> => {
      try {
        const fullPattern = fullKeyName(pattern);
        const keys = await client.keys(fullPattern);
        return keys.map(key => key.slice(Math.max(NONE, prefix().length)));
      } catch (error) {
        CACHE_DRIVER_ERROR_COUNT.labels("keys").inc();
        logger.warn({ error }, `cache keys error`);
        return [];
      }
    },
    set: async <T>(
      key: string,
      value: T,
      ttl = config.boilerplate.CACHE_TTL,
    ): Promise<void> => {
      try {
        const fullKey = fullKeyName(key);
        await client.set(fullKey, value, ttl);
        CACHE_SET_OPERATIONS_TOTAL.inc({
          key: fullKey,
          prefix: config.boilerplate.CACHE_PREFIX,
        });
      } catch (error) {
        CACHE_DRIVER_ERROR_COUNT.labels("set").inc();
        logger.error({ error }, `cache set error`);
      }
    },
    setClient: newClient => {
      logger.debug(`using new cache driver`);
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

declare module "../../utilities" {
  export interface ZCCDefinition {
    cache: TCache;
  }
}
