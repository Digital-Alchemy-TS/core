import { Counter, Gauge } from "prom-client";

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
