/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { createClient } from "redis";

import { CacheDriverOptions, ICacheDriver, is, SECOND } from "..";
/**
 * url & name properties automatically generated from config
 */
export async function createRedisDriver(
  { logger, config, lifecycle, internal }: CacheDriverOptions,
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
        internal.boilerplate.metrics.REDIS_ERROR_COUNT.inc();
      }
    },
    async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
      try {
        const start = process.hrtime();
        const out = await client.get(key);
        const diff = process.hrtime(start);
        const durationInMilliseconds = diff[0] * SECOND + diff[1] / 1e6;
        internal.boilerplate.metrics.REDIS_OPERATION_LATENCY_MS.observe(
          durationInMilliseconds,
        );
        if (out !== null && is.string(out)) {
          return JSON.parse(out) as T;
        }
        return defaultValue;
      } catch (error) {
        logger.error({ err: error, name: "get" }, "redis cache error");
        internal.boilerplate.metrics.REDIS_ERROR_COUNT.inc();
        return defaultValue;
      }
    },
    async keys(pattern?: string) {
      try {
        return await client.keys(pattern || "*");
      } catch (error) {
        logger.error({ err: error, name: "keys" }, "redis cache error");
        internal.boilerplate.metrics.REDIS_ERROR_COUNT.inc();
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
        internal.boilerplate.metrics.REDIS_ERROR_COUNT.inc();
      }
    },
  };
}
