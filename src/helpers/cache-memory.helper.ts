/* eslint-disable sonarjs/no-duplicate-string */
import NodeCache from "node-cache";

import { CacheDriverOptions, ICacheDriver, is } from "..";

/**
 * url & name properties automatically generated from config
 */
export function createMemoryDriver(
  { logger, config, lifecycle }: CacheDriverOptions,
  options?: NodeCache.Options,
): ICacheDriver {
  let client = new NodeCache({
    stdTTL: config.boilerplate.CACHE_TTL,
    ...options,
  });

  lifecycle.onShutdownStart(() => {
    logger.info({ name: "onShutdownStart" }, `cleanup`);
    client = undefined;
  });

  return {
    async del(key: string) {
      try {
        client.del(key);
      } catch (error) {
        logger.error({ err: error, name: "del" }, "memory cache error");
      }
    },
    async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
      try {
        const out = client.get(key);
        if (is.string(out)) {
          return JSON.parse(out) as T;
        }
        return defaultValue;
      } catch (error) {
        logger.error({ err: error, name: "get" }, "memory cache error");
        return defaultValue;
      }
    },
    async keys(pattern?: string) {
      try {
        const allKeys = client.keys();
        return pattern
          ? allKeys.filter((key) => new RegExp(pattern).test(key))
          : allKeys;
      } catch (error) {
        logger.error({ err: error, name: "keys" }, "memory cache error");
        return [];
      }
    },
    async set<T>(key: string, value: T, ttl: number) {
      try {
        client.set(key, JSON.stringify(value), ttl);
      } catch (error) {
        logger.error({ err: error, name: "set" }, "memory cache error");
      }
    },
  };
}
