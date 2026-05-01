/**
 * Global error event names and factory functions for event bus routing.
 *
 * @remarks
 * These constants are emitted as Node.js uncaught exception events and allow
 * applications to attach listeners that distinguish framework-level errors
 * (global, application, or library-scoped) from other process events.
 */

import { is } from "../index.mts";

/**
 * Event name for uncaught errors at the Node.js process level.
 */
export const DIGITAL_ALCHEMY_NODE_GLOBAL_ERROR = "DIGITAL_ALCHEMY_NODE_GLOBAL_ERROR";

/**
 * Event name for errors thrown during application bootstrap or operation.
 */
export const DIGITAL_ALCHEMY_APPLICATION_ERROR = "DIGITAL_ALCHEMY_APPLICATION_ERROR";

/**
 * Factory for library-scoped error event names.
 *
 * @remarks
 * When `library` is provided, returns a namespaced event name
 * (`DIGITAL_ALCHEMY_LIBRARY_ERROR:${library}`) to allow listening for errors
 * from a specific library. When not provided or empty, returns the base
 * `DIGITAL_ALCHEMY_LIBRARY_ERROR` constant.
 */
export const DIGITAL_ALCHEMY_LIBRARY_ERROR = (library?: string) =>
  is.empty(library) ? "DIGITAL_ALCHEMY_LIBRARY_ERROR" : `DIGITAL_ALCHEMY_LIBRARY_ERROR:${library}`;
