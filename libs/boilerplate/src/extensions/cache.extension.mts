import { ZCC } from "@zcc/utilities";
import NodeCache from "node-cache";
import Redis from "redis";

import {
  CACHE_DEFAULT_TTL_SECONDS,
  CACHE_DELETE_OPERATIONS_TOTAL,
  CACHE_GET_OPERATIONS_TOTAL,
  CACHE_KEYLIST_OPERATIONS_TOTAL,
  CACHE_SET_OPERATIONS_TOTAL,
} from "../helpers/metrics.helper.mjs";

interface ICacheConfig {
  CACHE_PREFIX: string;
  CACHE_TTL: number;
}

interface ICacheDriver {
  get<T>(key: string): Promise<T>;
  set<T>(key: string, value: T, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

// Prometheus metrics
function createCache() {
  let config: ICacheConfig;
  let client: ICacheDriver;

  function configure(cfg: ICacheConfig): void {
    config = cfg;
    CACHE_DEFAULT_TTL_SECONDS.set({ prefix: cfg.CACHE_PREFIX }, cfg.CACHE_TTL);
  }

  function init(driverConstructor?: (cfg: ICacheConfig) => ICacheDriver): void {
    client = driverConstructor
      ? driverConstructor(config)
      : createMemoryDriver(config);
  }

  async function get<T>(key: string): Promise<T> {
    const fullKey = fullKeyName(key);
    const result = await client.get(fullKey);
    CACHE_GET_OPERATIONS_TOTAL.inc({
      hit_miss: result ? "hit" : "miss",
      key: fullKey,
      prefix: config.CACHE_PREFIX,
    });
    return result as T;
  }

  async function set<T>(
    key: string,
    value: T,
    ttl: number = config.CACHE_TTL,
  ): Promise<void> {
    const fullKey = fullKeyName(key);
    await client.set(fullKey, value, ttl);
    CACHE_SET_OPERATIONS_TOTAL.inc({
      key: fullKey,
      prefix: config.CACHE_PREFIX,
    });
  }

  async function del(key: string): Promise<void> {
    const fullKey = fullKeyName(key);
    await client.del(fullKey);
    CACHE_DELETE_OPERATIONS_TOTAL.inc({
      key: fullKey,
      prefix: config.CACHE_PREFIX,
    });
  }

  async function keys(pattern?: string): Promise<string[]> {
    CACHE_KEYLIST_OPERATIONS_TOTAL.inc({ prefix: config.CACHE_PREFIX });
    return client.keys(fullKeyName(pattern || "*"));
  }

  function fullKeyName(key: string): string {
    return `${config.CACHE_PREFIX}${key}`;
  }

  function child(prefix: string): ReturnType<typeof createCache> {
    const childCache = createCache();
    childCache.configure({
      ...config,
      CACHE_PREFIX: `${config.CACHE_PREFIX}${prefix}`,
    });
    childCache.init(client);
    return childCache;
  }

  return { child, configure, del, get, init, keys, set };
}

export function createMemoryDriver(config: ICacheConfig): ICacheDriver {
  const client = new NodeCache({ stdTTL: config.CACHE_TTL });

  return {
    async del(key: string) {
      client.del(key);
    },
    async get(key: string) {
      return client.get(key);
    },
    async keys(pattern?: string) {
      const allKeys = client.keys();
      return pattern ? allKeys.filter(key => key.includes(pattern)) : allKeys;
    },
    async set(key: string, value: any, ttl: number) {
      client.set(key, value, ttl);
    },
  };
}

export function createRedisDriver(config: ICacheConfig): ICacheDriver {
  const client = new Redis();

  return {
    async del(key: string) {
      await client.del(key);
    },
    async get(key: string) {
      return client.get(key);
    },
    async keys(pattern?: string) {
      return client.keys(pattern || "*");
    },
    async set<T>(key: string, value: T, ttl: number) {
      await client.set(key, value, "EX", ttl);
    },
  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    cache: ReturnType<typeof createCache>;
  }
}

ZCC.cache = createCache();
