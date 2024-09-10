/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { createClient } from "redis";

import { CacheDriverOptions, ICacheDriver, is } from "..";
/**
 * url & name properties automatically generated from config
 */
export async function createRedisDriver(
  { logger, config, lifecycle }: CacheDriverOptions,
  options?: Parameters<typeof createClient>[0],
): Promise<ICacheDriver> {
  let client = createClient({
    url: config.boilerplate.REDIS_URL,
    ...options,
  });
  await client.connect();

  lifecycle.onShutdownStart(async () => {
    logger.info({ name: "onShutdownStart" }, `disconnecting`);
    await client.disconnect();
    client = undefined;
  });

  return {
    async del(key: string) {
      try {
        await client.del(key);
      } catch (error) {
        logger.error({ err: error, name: "del" }, "redis cache error");
      }
    },
    async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
      try {
        const out = await client.get(key);
        if (out !== null && is.string(out)) {
          return JSON.parse(out) as T;
        }
        return defaultValue;
      } catch (error) {
        logger.error({ err: error, name: "get" }, "redis cache error");
        return defaultValue;
      }
    },
    async keys(pattern?: string) {
      try {
        return await client.keys(pattern || "*");
      } catch (error) {
        logger.error({ err: error, name: "keys" }, "redis cache error");
        return [];
      }
    },
    async set<T>(key: string, value: T, ttl: number) {
      try {
        await client.set(key, JSON.stringify(value), {
          EX: ttl,
        });
      } catch (error) {
        logger.error({ err: error, name: "set" }, "redis cache error");
      }
    },
  };
}
