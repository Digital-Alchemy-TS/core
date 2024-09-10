import {
  createMemoryDriver,
  createRedisDriver,
  ICacheDriver,
  NONE,
  TCache,
  TServiceParams,
} from "..";
import { is } from ".";

export function Cache({
  logger,
  lifecycle,
  config,
  internal,
}: TServiceParams): TCache {
  let client: ICacheDriver;
  const prefix = () =>
    config.boilerplate.CACHE_PREFIX || internal.boot.application.name;

  function fullKeyName(key: string): string {
    return `${config.boilerplate.CACHE_PREFIX}${key}`;
  }

  // #MARK: onPostConfig
  lifecycle.onPostConfig(async () => {
    if (client) {
      return;
    }
    logger.trace(
      { name: "onPostConfig", provider: config.boilerplate.CACHE_PROVIDER },
      `init cache`,
    );
    if (config.boilerplate.CACHE_PROVIDER === "redis") {
      client = await createRedisDriver({ config, internal, lifecycle, logger });
      return;
    }
    client = await createMemoryDriver({ config, internal, lifecycle, logger });
  });

  // #MARK: Return object
  return {
    [Symbol.for("cache_logger")]: logger,
    del: async (key: string): Promise<void> => {
      try {
        const fullKey = fullKeyName(key);
        await client.del(fullKey);
      } catch (error) {
        logger.error({ error, name: "del" }, `cache error`);
      }
    },
    get: async <T>(key: string, defaultValue?: T): Promise<T> => {
      try {
        const fullKey = fullKeyName(key);
        const result = await client.get(fullKey);
        return is.undefined(result) ? defaultValue : (result as T);
      } catch (error) {
        logger.warn({ defaultValue, error, key, name: "get" }, `cache error`);
        return defaultValue;
      }
    },
    keys: async (pattern = ""): Promise<string[]> => {
      try {
        const fullPattern = fullKeyName(pattern);
        const keys = await client.keys(fullPattern);
        return keys.map((key) => key.slice(Math.max(NONE, prefix().length)));
      } catch (error) {
        logger.warn({ error, name: "keys" }, `cache error`);
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
      } catch (error) {
        logger.error({ error, name: "set" }, `cache error`);
      }
    },
    setClient: (newClient) => {
      logger.debug({ name: "setClient" }, `using new cache driver`);
      client = newClient;
    },
  } as TCache;
}
