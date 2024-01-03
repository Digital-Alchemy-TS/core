import { ZCC } from "@zcc/utilities";

import {
  CACHE_HOST,
  CACHE_PORT,
  CACHE_PREFIX,
  CACHE_PROVIDER,
  CACHE_TTL,
  CONFIG,
  LOG_LEVEL,
  SCAN_CONFIG,
} from "./helpers/config.constants.mjs";

export const LIB_BOILERPLATE = ZCC.createLibrary({
  configuration: {
    [CACHE_HOST]: {
      default: "localhost",
      description:
        "Configuration property for cache provider, does not apply to memory caching",
      type: "string",
    },
    [CACHE_PORT]: {
      // If other cache providers are implemented, the default value should will be removed
      // The value default value will need to be determined programmatically (should keep backwards compatibility)
      default: 6379,
      description:
        "Configuration property for cache provider, does not apply to memory caching",
      type: "number",
    },
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
      description: "Configuration property for cache provider",
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
    [SCAN_CONFIG]: {
      default: false,
      description: "Find all application configurations and output as json",
      type: "boolean",
    },
  },
  library: "boilerplate",
});
