import { Counter, Gauge } from "prom-client";

/**
 * Cache delete operations counter
 */
export const CACHE_DELETE_OPERATIONS_TOTAL = new Counter({
  help: "Total number of cache delete operations",
  labelNames: ["prefix", "key"],
  name: "cache_delete_operations_total",
});

/**
 * Cache get operations counter
 */
export const CACHE_GET_OPERATIONS_TOTAL = new Counter({
  help: "Total number of cache get operations",
  labelNames: ["prefix", "key", "hit_miss"],
  name: "cache_get_operations_total",
});

/**
 * Cache key list operations counter
 */
export const CACHE_KEYLIST_OPERATIONS_TOTAL = new Counter({
  help: "Total number of cache key list operations",
  labelNames: ["prefix"],
  name: "cache_keylist_operations_total",
});

/**
 * Cache set operations counter
 */
export const CACHE_SET_OPERATIONS_TOTAL = new Counter({
  help: "Total number of cache set operations",
  labelNames: ["prefix", "key"],
  name: "cache_set_operations_total",
});

/**
 * Default Time-To-Live for cache entries gauge
 */
export const CACHE_DEFAULT_TTL_SECONDS = new Gauge({
  help: "Default Time-To-Live for cache entries",
  labelNames: ["prefix"],
  name: "cache_default_ttl_seconds",
});

/**
 * Counts the total number of initiated fetch requests.
 */
export const FETCH_REQUESTS_INITIATED = new Counter({
  help: "Total number of fetch requests that have been initiated",
  name: "fetch_requests_initiated_total",
});

/**
 * Counts the total number of successfully completed fetch requests.
 */
export const FETCH_REQUESTS_SUCCESSFUL = new Counter({
  help: "Total number of fetch requests that have been successfully completed",
  name: "fetch_requests_successful_total",
});

/**
 * Counts the total number of failed fetch requests.
 */
export const FETCH_REQUESTS_FAILED = new Counter({
  help: "Total number of fetch requests that have failed",
  name: "fetch_requests_failed_total",
});

/**
 * Measures the delay (in milliseconds) experienced by requests due to bottleneck rate limiting.
 */
export const FETCH_REQUEST_BOTTLENECK_DELAY = new Gauge({
  help: "Delay in milliseconds experienced by requests due to bottleneck rate limiting",
  name: "fetch_request_bottleneck_delay_milliseconds",
});
