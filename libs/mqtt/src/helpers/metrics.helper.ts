import { Counter, Summary } from "prom-client";

/**
 * MQTT Message Handling Execution Time (Summary)
 * This metric tracks the duration of MQTT message handling.
 *
 * Labels:
 * - context: The broader category or module the MQTT handling belongs to.
 * - label: A user-defined label to identify the specific MQTT handling.
 * - topic: The MQTT topic being subscribed to or published.
 */
export const MQTT_MESSAGE_HANDLING_TIME = new Summary({
  help: "Duration of MQTT message handling in seconds",
  labelNames: ["context", "label", "topic"] as const,
  name: "mqtt_message_handling_duration_seconds",
  percentiles: [0.5, 0.9, 0.99],
});

/**
 * MQTT Message Executions (Counter)
 * This metric counts the number of times MQTT messages are handled.
 *
 * Labels:
 * - context: The broader category or module the MQTT handling belongs to.
 * - label: A user-defined label to identify the specific MQTT handling.
 * - topic: The MQTT topic being subscribed to or published.
 */
export const MQTT_MESSAGE_EXECUTIONS = new Counter({
  help: "Total number of MQTT message executions",
  labelNames: ["context", "label", "topic"] as const,
  name: "mqtt_message_executions_total",
});

/**
 * MQTT Message Handling Errors (Counter)
 * This metric counts the number of errors that occur during MQTT message handling.
 *
 * Labels:
 * - context: The broader category or module the MQTT handling belongs to.
 * - label: A user-defined label to identify the specific MQTT handling where the error occurred.
 * - topic: The MQTT topic being subscribed to or published.
 */
export const MQTT_MESSAGE_ERRORS = new Counter({
  help: "Total number of errors occurred during MQTT message handling",
  labelNames: ["context", "label", "topic"] as const,
  name: "mqtt_message_handling_errors_total",
});
