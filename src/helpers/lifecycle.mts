/**
 * Lifecycle types and stage definitions — the ordered callback hooks that
 * frame application startup and shutdown.
 *
 * @remarks
 * Services register callbacks at specific lifecycle stages; the wiring engine
 * executes them in strict order. Callbacks can be prioritized (positive = early,
 * negative = late, unspecified = parallel). Each stage represents a well-defined
 * point where certain actions are safe: `onPreInit` before config,
 * `onPostConfig` after, `onBootstrap` after all modules are wired, `onReady`
 * when the app is running, and three shutdown stages for graceful termination.
 */

import type { TBlackHole } from "./utilities.mts";

/**
 * Function signature for a lifecycle callback — takes no arguments, returns nothing.
 */
export type LifecycleCallback = () => TBlackHole;

/**
 * Prioritized callback — a tuple of callback function and numeric priority.
 *
 * @remarks
 * Used internally by the lifecycle engine to sort callbacks before execution.
 * Higher priorities run first; unspecified (default) callbacks run in parallel;
 * negative priorities run last.
 *
 * @internal
 */
export type LifecyclePrioritizedCallback = [callback: LifecycleCallback, priority: number];

/**
 * Ordered collection of prioritized callbacks.
 *
 * @internal
 */
export type CallbackList = LifecyclePrioritizedCallback[];

/**
 * Function signature for registering a lifecycle callback.
 *
 * @remarks
 * Services call these methods to attach callbacks at specific lifecycle stages.
 * The optional `priority` argument controls execution order:
 * positive = early (high to low), undefined = parallel, negative = late.
 */
export type TLifeCycleRegister = (callback: LifecycleCallback, priority?: number) => void;

/**
 * Core lifecycle interface — seven stages with callback registration methods.
 *
 * @remarks
 * Each method (`onPreInit`, `onPostConfig`, etc.) accepts a callback and optional
 * priority. Callbacks are invoked by the bootstrap engine in strict stage order,
 * with priorities controlling execution within each stage.
 */
export type TLifecycleBase = {
  /**
   * Registers a callback for the pre-initialization phase, executed before config is loaded.
   *
   * @remarks
   * Safe for basic state setup; do not read config values at this stage.
   *
   * Priority: positive = early, undefined = parallel, negative = late.
   */
  onPreInit: TLifeCycleRegister;

  /**
   * Registers a callback for the post-configuration phase, executed after config is ready.
   *
   * @remarks
   * Safe to read and validate config values; all modules are not yet wired.
   *
   * Priority: positive = early, undefined = parallel, negative = late.
   */
  onPostConfig: TLifeCycleRegister;

  /**
   * Registers a callback for the bootstrap phase, executed when all modules are wired.
   *
   * @remarks
   * Safe to call other services and set up inter-service dependencies.
   *
   * Priority: positive = early, undefined = parallel, negative = late.
   */
  onBootstrap: TLifeCycleRegister;

  /**
   * Registers a callback for the ready phase, executed when the app is fully running.
   *
   * @remarks
   * Safe to start schedulers, timers, and external integrations.
   *
   * Priority: positive = early, undefined = parallel, negative = late.
   */
  onReady: TLifeCycleRegister;

  /**
   * Registers a callback for the pre-shutdown phase, notification of intended shutdown.
   *
   * @remarks
   * First shutdown hook; used for graceful degradation or cleanup signaling.
   *
   * Priority: positive = early, undefined = parallel, negative = late.
   */
  onPreShutdown: TLifeCycleRegister;

  /**
   * Registers a callback for the shutdown-start phase, begins active teardown.
   *
   * @remarks
   * Close connections, stop schedulers, and drain in-flight operations.
   *
   * Priority: positive = early, undefined = parallel, negative = late.
   */
  onShutdownStart: TLifeCycleRegister;

  /**
   * Registers a callback for the shutdown-complete phase, final cleanup.
   *
   * @remarks
   * Last-resort cleanup after all other teardown is done.
   *
   * Priority: positive = early, undefined = parallel, negative = late.
   */
  onShutdownComplete: TLifeCycleRegister;
};

/**
 * Extended lifecycle interface with child lifecycle factory.
 *
 * @remarks
 * Used by scoped contexts (e.g., per-request) to create child lifecycle instances
 * that fire callbacks within their own scope.
 *
 * @internal
 */
export type TParentLifecycle = TLifecycleBase & {
  child: () => TLifecycleBase;
};

/**
 * Ordered lifecycle stages — the canonical sequence of bootstrap and shutdown phases.
 *
 * @remarks
 * This array defines the execution order. Do not change the order; it is relied
 * upon by the wiring engine to route callbacks and ensure safe state transitions.
 */
export const LIFECYCLE_STAGES = [
  "PreInit",
  "PostConfig",
  "Bootstrap",
  "Ready",
  "PreShutdown",
  "ShutdownStart",
  "ShutdownComplete",
] as const;

/**
 * Union type of all lifecycle stage names.
 */
export type LifecycleStages = (typeof LIFECYCLE_STAGES)[number];
