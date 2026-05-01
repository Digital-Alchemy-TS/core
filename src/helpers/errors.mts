/**
 * Framework exception types for structured error handling and lifecycle management.
 *
 * @remarks
 * The framework uses two canonical exception classes: `BootstrapException` for
 * wiring-time errors (configuration, module loading, dependency resolution) and
 * `InternalError` for runtime logic errors after bootstrap. Both carry `context`,
 * `cause` (error code), and `timestamp` to support observability and debugging.
 */

import type { TContext } from "./context.mts";

/**
 * Exception thrown during application bootstrap or module wiring.
 *
 * @remarks
 * Indicates failures during dependency graph construction, configuration parsing,
 * or module initialization. These errors should prevent the application from
 * starting. The `cause` field carries a `SCREAMING_SNAKE_CODE` for programmatic
 * handling; the `message` field is the human-readable description.
 */
export class BootstrapException extends Error {
  /** Request context under which the exception occurred. */
  context: TContext;

  /**
   * Machine-readable error code (e.g., `MISSING_CONFIG`, `UNKNOWN_MODULE`).
   *
   * @remarks
   * Overrides the inherited `Error.cause` to ensure consistency with the
   * framework's error classification scheme.
   */
  override cause: string;

  /** Timestamp when the exception was created. */
  timestamp: Date;

  constructor(context: TContext, cause: string, message: string) {
    super();
    this.name = "BootstrapException";
    this.message = message;
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date();
  }
}

/**
 * Exception thrown during runtime operation after bootstrap.
 *
 * @remarks
 * Indicates logic errors, invalid state transitions, or failed assertions that
 * occur after the application is fully initialized and running. These are
 * typically unexpected but non-fatal; the `cause` field carries an error code
 * for observability and alerting.
 */
export class InternalError extends Error {
  /** Request context under which the error occurred. */
  context: TContext;

  /**
   * Machine-readable error code (e.g., `NOT_FOUND`, `INVALID_STATE`).
   *
   * @remarks
   * Overrides the inherited `Error.cause` to ensure consistency with the
   * framework's error classification scheme.
   */
  override cause: string;

  /** Timestamp when the error was created. */
  timestamp: Date;

  constructor(context: TContext, cause: string, message: string) {
    super();
    this.name = "InternalError";
    this.message = cause;
    this.context = context;
    this.cause = message;
    this.timestamp = new Date();
  }
}
