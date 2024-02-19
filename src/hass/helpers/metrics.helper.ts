import { Counter, Summary } from "prom-client";

/**
 * Tracks the number of times a socket event callback has been executed.
 */
export const SOCKET_EVENT_EXECUTION_COUNT = new Counter({
  help: "Counts the number of times a socket event callback has been executed",
  labelNames: ["context", "label", "event"] as const,
  name: "digital_alchemy_home_assistant_socket_event_callback_execution_count",
});

/**
 * Counts the number of errors occurred during socket event callback executions.
 */
export const SOCKET_EVENT_ERRORS = new Counter({
  help: "Counts the number of errors during socket event callback executions",
  labelNames: ["context", "label", "event"] as const,
  name: "digital_alchemy_home_assistant_socket_event_callback_errors",
});

/**
 * Summary for Execution Time
 */
export const SOCKET_EVENT_EXECUTION_TIME = new Summary({
  help: "Measures the duration of each socket event callback execution",
  labelNames: ["context", "label", "event"] as const,
  name: "digital_alchemy_home_assistant_socket_event_callback_execution_time",
  percentiles: [0.5, 0.9, 0.99],
});
