import { Counter, Summary } from "prom-client";

/**
 * Tracks the number of times a button callback has been executed.
 */
export const BUTTON_EXECUTION_COUNT = new Counter({
  help: "Counts the number of times a button callback has been executed",
  labelNames: ["context", "label"] as const,
  name: "zcc_virtual_entity_button_callback_execution_count",
});

/**
 * Counts the number of errors occurred during button callback executions.
 */
export const BUTTON_ERRORS = new Counter({
  help: "Counts the number of errors during button callback executions",
  labelNames: ["context", "label"] as const,
  name: "zcc_virtual_entity_button_callback_errors",
});

/**
 * Summary for Execution Time
 */
export const BUTTON_EXECUTION_TIME = new Summary({
  help: "Measures the duration of button press callback execution",
  labelNames: ["context", "label"] as const,
  name: "zcc_virtual_entity_button_callback_execution_time",
  percentiles: [0.5, 0.9, 0.99],
});
