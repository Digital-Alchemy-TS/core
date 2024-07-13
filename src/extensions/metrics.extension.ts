/* eslint-disable @typescript-eslint/no-magic-numbers */
import { Counter, Gauge, Histogram, Summary } from "prom-client";

const build = () => {
  /**
   * Cache delete operations counter
   */
  const CACHE_DELETE_OPERATIONS_TOTAL = new Counter({
    help: "Total number of cache delete operations",
    labelNames: ["prefix", "key"] as const,
    name: "digital_alchemy_boilerplate_cache_delete_operations_total",
  });

  /**
   * Cache get operations counter
   */
  const CACHE_GET_OPERATIONS_TOTAL = new Counter({
    help: "Total number of cache get operations",
    labelNames: ["prefix", "key", "hit_miss"] as const,
    name: "digital_alchemy_boilerplate_cache_get_operations_total",
  });

  /**
   * Tracks the number of times a scheduled task has been executed.
   * Labels:
   * - context: The broader category or module the schedule belongs to.
   * - label: A user-defined label to identify the specific schedule.
   */
  const SCHEDULE_EXECUTION_COUNT = new Counter({
    help: "Counts the number of times a scheduled task has been executed",
    labelNames: ["context", "label"] as const,
    name: "digital_alchemy_boilerplate_schedule_execution_count",
  });

  /**
   * Counts the number of errors occurred during scheduled task executions.
   * Labels:
   * - context: The broader category or module the schedule belongs to.
   * - label: A user-defined label to identify the specific schedule where the error occurred.
   */
  const SCHEDULE_ERRORS = new Counter({
    help: "Counts the number of errors during scheduled task executions",
    labelNames: ["context", "label"] as const,
    name: "digital_alchemy_boilerplate_schedule_errors",
  });

  /**
   * Summary for Execution Time
   */
  const SCHEDULE_EXECUTION_TIME = new Summary({
    help: "Measures the duration of each cron job or interval execution",
    labelNames: ["context", "label"] as const,
    name: "digital_alchemy_boilerplate_schedule_execution_time",
    // These percentiles are just examples; adjust them based on what's relevant for your analysis
    percentiles: [0.5, 0.9, 0.99],
  });

  /**
   * Metric to count errors in cache driver
   */
  const CACHE_DRIVER_ERROR_COUNT = new Counter({
    help: "Counts the number of errors caught in the cache driver",
    labelNames: ["methodName"] as const,
    name: "digital_alchemy_boilerplate_cache_driver_error_count",
  });

  /**
   * Cache set operations counter
   */
  const CACHE_SET_OPERATIONS_TOTAL = new Counter({
    help: "Total number of cache set operations",
    labelNames: ["prefix", "key"] as const,
    name: "digital_alchemy_boilerplate_cache_set_operations_total",
  });

  /**
   * Counts the total number of initiated fetch requests.
   */
  const FETCH_REQUESTS_INITIATED = new Counter({
    help: "Total number of fetch requests that have been initiated",
    name: "digital_alchemy_boilerplate_fetch_requests_initiated_total",
  });

  /**
   * Counts the total number of successfully completed fetch requests.
   */
  const FETCH_REQUESTS_SUCCESSFUL = new Counter({
    help: "Total number of fetch requests that have been successfully completed",
    labelNames: ["context", "label"] as const,
    name: "digital_alchemy_boilerplate_fetch_requests_successful_total",
  });

  /**
   * Counts the total number of successfully completed fetch requests.
   */
  const FETCH_DOWNLOAD_REQUESTS_SUCCESSFUL = new Counter({
    help: "Total number of fetch download requests that have been successfully completed",
    labelNames: ["context", "label"] as const,
    name: "digital_alchemy_boilerplate_fetch_download_requests_successful_total",
  });

  /**
   * Counts the total number of failed fetch requests.
   */
  const FETCH_REQUESTS_FAILED = new Counter({
    help: "Total number of fetch requests that have failed",
    labelNames: ["context", "label"] as const,
    name: "digital_alchemy_boilerplate_fetch_requests_failed_total",
  });

  /**
   * Gauge to count the number of errors encountered in Redis operations.
   */
  const REDIS_ERROR_COUNT = new Gauge({
    help: "Counts the number of errors encountered in Redis operations",
    name: "digital_alchemy_boilerplate_redis_error_count",
  });

  /**
   * Histogram to track the latency of Redis operations in milliseconds.
   * Buckets range from 0.1 ms to 1000 ms (1 second) for granular latency measurement.
   */
  const REDIS_OPERATION_LATENCY_MS = new Histogram({
    buckets: [0.1, 0.5, 1, 5, 10, 20, 50, 100, 200, 500, 1000],
    help: "Histogram for tracking the latency of Redis operations in milliseconds",
    name: "digital_alchemy_boilerplate_redis_operation_latency_ms",
  });

  /**
   * Counter to track the number of errors encountered in memory cache operations.
   */
  const MEMORY_CACHE_ERROR_COUNT = new Counter({
    help: "Counts the number of errors encountered in memory cache operations",
    name: "digital_alchemy_boilerplate_memory_cache_error_count",
  });

  /**
   * A Prometheus gauge metric that tracks the number of unique context entries in the logger's context cache.
   * This helps in monitoring and managing the memory usage associated with the caching of logger contexts.
   */
  const LOGGER_CONTEXT_ENTRIES_COUNT = new Gauge({
    help: "Number of unique context entries in the logger context cache",
    name: "digital_alchemy_boilerplate_logger_context_entries_count",
  });

  return {
    CACHE_DELETE_OPERATIONS_TOTAL,
    CACHE_DRIVER_ERROR_COUNT,
    CACHE_GET_OPERATIONS_TOTAL,
    CACHE_SET_OPERATIONS_TOTAL,
    FETCH_DOWNLOAD_REQUESTS_SUCCESSFUL,
    FETCH_REQUESTS_FAILED,
    FETCH_REQUESTS_INITIATED,
    FETCH_REQUESTS_SUCCESSFUL,
    LOGGER_CONTEXT_ENTRIES_COUNT,
    MEMORY_CACHE_ERROR_COUNT,
    REDIS_ERROR_COUNT,
    REDIS_OPERATION_LATENCY_MS,
    SCHEDULE_ERRORS,
    SCHEDULE_EXECUTION_COUNT,
    SCHEDULE_EXECUTION_TIME,
  };
};

let metrics: ReturnType<typeof build>;

export function Metrics() {
  metrics ??= build();
  return metrics;
}
