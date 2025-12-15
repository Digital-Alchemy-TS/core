import type { TBlackHole } from "./utilities.mts";

export type LifecycleCallback = () => TBlackHole;
export type LifecyclePrioritizedCallback = [callback: LifecycleCallback, priority: number];
export type CallbackList = LifecyclePrioritizedCallback[];

export type TLifeCycleRegister = (callback: LifecycleCallback, priority?: number) => void;

export type TLifecycleBase = {
  /**
   * Registers a callback for the bootstrap phase, executed during the initial startup process.
   *
   * Optional priority arg: negative values -> no value -> positive value
   */
  onBootstrap: TLifeCycleRegister;

  /**
   * Registers a callback for immediately after the configuration phase, allowing post-configuration adjustments.
   *
   * Optional priority arg: negative values -> no value -> positive value
   */
  onPostConfig: TLifeCycleRegister;

  /**
   * Registers a callback for the pre-initialization phase, executed before the main initialization starts.
   *
   * Optional priority arg: negative values -> no value -> positive value
   */
  onPreInit: TLifeCycleRegister;

  /**
   * Registers a callback for when the system is fully initialized and ready.
   *
   * Optional priority arg: negative values -> no value -> positive value
   */
  onReady: TLifeCycleRegister;

  /**
   * Notification that the application intends to shut down.
   *
   * Optional priority arg: negative values -> no value -> positive value
   */
  onPreShutdown: TLifeCycleRegister;

  /**
   * Begins the shutdown process, typically invoked when the system is about to shut down.
   *
   * Optional priority arg: negative values -> no value -> positive value
   */
  onShutdownStart: TLifeCycleRegister;

  /**
   * Completes the shutdown process, executed after all shutdown procedures are complete.
   *
   * Optional priority arg: negative values -> no value -> positive value
   */
  onShutdownComplete: TLifeCycleRegister;
};

export type TParentLifecycle = TLifecycleBase & {
  child: () => TLifecycleBase;
};

// ! This is a sorted array! Don't change the order
export const LIFECYCLE_STAGES = [
  "PreInit",
  "PostConfig",
  "Bootstrap",
  "Ready",
  "PreShutdown",
  "ShutdownStart",
  "ShutdownComplete",
] as const;

export type LifecycleStages = (typeof LIFECYCLE_STAGES)[number];
