/* eslint-disable @typescript-eslint/no-magic-numbers */
import { Counter, Gauge, Histogram } from "prom-client";

/**
 * Cache delete operations counter
 */
export const CACHE_DELETE_OPERATIONS_TOTAL = new Counter({
  help: "Total number of cache delete operations",
  labelNames: ["prefix", "key"] as const,
  name: "cache_delete_operations_total",
});

/**
 * Cache get operations counter
 */
export const CACHE_GET_OPERATIONS_TOTAL = new Counter({
  help: "Total number of cache get operations",
  labelNames: ["prefix", "key", "hit_miss"] as const,
  name: "cache_get_operations_total",
});

/**
 * Metric to count errors in cache driver
 */
export const CACHE_DRIVER_ERROR_COUNT = new Counter({
  help: "Counts the number of errors caught in the cache driver",
  labelNames: ["methodName"] as const,
  name: "CACHE_DRIVER_ERROR_COUNT",
});

/**
 * Cache set operations counter
 */
export const CACHE_SET_OPERATIONS_TOTAL = new Counter({
  help: "Total number of cache set operations",
  labelNames: ["prefix", "key"] as const,
  name: "cache_set_operations_total",
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
/**
 * Gauge to count the number of errors encountered in Redis operations.
 */
export const REDIS_ERROR_COUNT = new Gauge({
  help: "Counts the number of errors encountered in Redis operations",
  name: "redis_error_count",
});

/**
 * Histogram to track the latency of Redis operations in milliseconds.
 * Buckets range from 0.1 ms to 1000 ms (1 second) for granular latency measurement.
 */
export const REDIS_OPERATION_LATENCY_MS = new Histogram({
  buckets: [0.1, 0.5, 1, 5, 10, 20, 50, 100, 200, 500, 1000],
  help: "Histogram for tracking the latency of Redis operations in milliseconds",
  name: "redis_operation_latency_ms",
});

/**
 * Counter to track the number of errors encountered in memory cache operations.
 */
export const MEMORY_CACHE_ERROR_COUNT = new Counter({
  help: "Counts the number of errors encountered in memory cache operations",
  name: "memory_cache_error_count",
});

/**
 * A Prometheus gauge metric that tracks the number of unique context entries in the logger's context cache.
 * This helps in monitoring and managing the memory usage associated with the caching of logger contexts.
 */
export const LOGGER_CONTEXT_ENTRIES_COUNT = new Gauge({
  help: "Number of unique context entries in the logger context cache",
  name: "logger_context_entries_count",
});
