import { ZCC } from "@zcc/utilities";

import { LIB_BOILERPLATE } from "../boilerplate.module.mjs";
import { CACHE_TTL } from "../helpers/config.constants.mjs";
import {
  CACHE_DEFAULT_TTL_SECONDS,
  CACHE_DELETE_OPERATIONS_TOTAL,
  CACHE_GET_OPERATIONS_TOTAL,
  CACHE_KEYLIST_OPERATIONS_TOTAL,
} from "../helpers/metrics.helper.mjs";

export interface ICacheDriver {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

function createCache(prefix: string = "", client?: ICacheDriver) {
  function configure(): void {
    CACHE_DEFAULT_TTL_SECONDS.set(
      { prefix },
      LIB_BOILERPLATE.getConfig(CACHE_TTL),
    );
  }

  const logger = ZCC.logger.context(`cache:${prefix}`);

  // function init(driverConstructor?: ICacheDriver): void {
  //   // client = driverConstructor
  //   //   ? driverConstructor(config)
  //   //   : createMemoryDriver(config);
  // }

  function fullKeyName(key: string): string {
    return `${prefix}${key}`;
  }

  return {
    // child: (prefix: string): ReturnType<typeof createCache> => {
    //   const childCache = createCache();
    //   childCache.configure();
    //   // childCache.init(client);
    //   return childCache;
    // },
    configure,
    del: async (key: string): Promise<void> => {
      const fullKey = fullKeyName(key);
      await client.del(fullKey);
      CACHE_DELETE_OPERATIONS_TOTAL.inc({
        key: fullKey,
        prefix,
      });
    },
    get: async <T,>(key: string): Promise<T> => {
      const fullKey = fullKeyName(key);
      const result = await client.get(fullKey);
      CACHE_GET_OPERATIONS_TOTAL.inc({
        hit_miss: result ? "hit" : "miss",
        key: fullKey,
        prefix,
      });
      return result as T;
    },
    // init: async <T,>(
    //   // key: string,
    //   value: T,
    //   // ttl: number = config.CACHE_TTL,
    // ): Promise<void> => {
    //   // const fullKey = fullKeyName(key);
    //   // await client.set(fullKey, value, ttl);
    //   // CACHE_SET_OPERATIONS_TOTAL.inc({
    //   //   key: fullKey,
    //   //   prefix,
    //   // });
    // },
    keys: async (pattern?: string): Promise<string[]> => {
      CACHE_KEYLIST_OPERATIONS_TOTAL.inc({ prefix });
      return client.keys(fullKeyName(pattern || "*"));
    },
    // set,
  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    cache: ReturnType<typeof createCache>;
  }
}

ZCC.cache = createCache();
