import { Counter, Summary } from "prom-client";

/**
 * Tracks the number of times a sequence matcher callback has been executed.
 */
export const SEQUENCE_MATCHER_EXECUTION_COUNT = new Counter({
  help: "Counts the number of times a sequence matcher callback has been executed",
  labelNames: ["context", "label"] as const,
  name: "zcc_automation_logic_sequence_matcher_callback_execution_count",
});

/**
 * Counts the number of errors occurred during sequence matcher callback executions.
 */
export const SEQUENCE_MATCHER_ERRORS = new Counter({
  help: "Counts the number of errors during sequence matcher callback executions",
  labelNames: ["context", "label"] as const,
  name: "zcc_automation_logic_sequence_matcher_callback_errors",
});

/**
 * Summary for Execution Time
 */
export const SEQUENCE_MATCHER_EXECUTION_TIME = new Summary({
  help: "Measures the duration of each cron job or interval execution",
  labelNames: ["context", "label"] as const,
  name: "zcc_automation_logic_sequence_matcher_callback_execution_time",
  percentiles: [0.5, 0.9, 0.99],
});
