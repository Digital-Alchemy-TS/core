import { ModuleConfiguration } from "../extensions/configuration.extension.mjs";

export const LOG_LEVEL = "LOG_LEVEL";
export const LOG_METRICS = "LOG_METRICS";
export const SCAN_CONFIG = "SCAN_CONFIG";
export const CONFIG = "CONFIG";
export const CACHE_PROVIDER = "CACHE_PROVIDER";
export const REDIS_URL = "REDIS_URL";
export const CACHE_TTL = "CACHE_TTL";
export const CACHE_PREFIX = "CACHE_PREFIX";

export const BOILERPLATE_LIB_NAME = "boilerplate";

export const LIB_BOILERPLATE_CONFIGURATION: ModuleConfiguration = {
  [CACHE_PREFIX]: {
    description: [
      "Use a prefix with all cache keys",
      "If blank, then application name is used",
    ].join(`. `),
    type: "string",
  },
  [CACHE_PROVIDER]: {
    default: "memory",
    description: "Redis is preferred if available",
    enum: ["redis", "memory"],
    type: "string",
  },
  [CACHE_TTL]: {
    default: 86_400,
    description: "Configuration property for cache provider, in seconds",
    type: "number",
  },
  [CONFIG]: {
    description: [
      "Consumable as CLI switch only",
      "If provided, all other file based configurations will be ignored",
      "Environment variables + CLI switches will operate normally",
    ].join(". "),
    type: "string",
  },
  [LOG_LEVEL]: {
    default: "info",
    description: "Minimum log level to process",
    enum: ["silent", "info", "warn", "debug", "error"],
    type: "string",
  },
  [LOG_METRICS]: {
    default: true,
    type: "boolean",
  },
  [REDIS_URL]: {
    default: "redis://localhost:6379",
    description:
      "Configuration property for cache provider, does not apply to memory caching",
    type: "string",
  },
  [SCAN_CONFIG]: {
    default: false,
    description: "Find all application configurations and output as json",
    type: "boolean",
  },
};
