/* eslint-disable @typescript-eslint/no-magic-numbers */
import { is, SECOND, ZCC } from "@zcc/utilities";
import { createClient } from "redis";

import { ICacheDriver } from "../extensions/cache.extension.mjs";
import { REDIS_URL } from "./config.constants.mjs";
import {
  REDIS_ERROR_COUNT,
  REDIS_OPERATION_LATENCY_MS,
} from "./metrics.helper.mjs";
import { TServiceParams } from "./wiring.helper.mjs";

/**
 * url & name properties automatically generated from config
 */
export function createRedisDriver(
  { logger, getConfig }: Pick<TServiceParams, "getConfig" | "logger">,
  options?: Parameters<typeof createClient>[0],
): ICacheDriver {
  const REDIS_CLIENT_NAME = ZCC.application?.application.name || "ZCC";

  logger.debug({ name: REDIS_CLIENT_NAME }, `Initializing redis driver`);

  const client = createClient({
    name: REDIS_CLIENT_NAME,
    url: getConfig(REDIS_URL),
    ...options,
  });

  return {
    async del(key: string) {
      try {
        await client.del(key);
      } catch (error) {
        logger.error({ err: error }, "Error in Redis del operation");
        REDIS_ERROR_COUNT.inc();
      }
    },
    async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
      try {
        const start = process.hrtime();
        const out = await client.get(key);
        const diff = process.hrtime(start);
        const durationInMilliseconds = diff[0] * SECOND + diff[1] / 1e6;
        REDIS_OPERATION_LATENCY_MS.observe(durationInMilliseconds);
        if (out !== null && is.string(out)) {
          return JSON.parse(out) as T;
        }
        return defaultValue;
      } catch (error) {
        logger.error({ err: error }, "Error in Redis get operation");
        REDIS_ERROR_COUNT.inc();
        return defaultValue;
      }
    },
    async keys(pattern?: string) {
      try {
        return await client.keys(pattern || "*");
      } catch (error) {
        logger.error({ err: error }, "Error in Redis keys operation");
        REDIS_ERROR_COUNT.inc();
        return [];
      }
    },
    async set<T>(key: string, value: T, ttl: number) {
      try {
        await client.set(key, JSON.stringify(value), {
          EX: ttl,
        });
      } catch (error) {
        logger.error({ err: error }, "Error in Redis set operation");
        REDIS_ERROR_COUNT.inc();
      }
    },
  };
}
