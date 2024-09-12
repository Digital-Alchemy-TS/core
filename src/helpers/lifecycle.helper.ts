import { TBlackHole } from "..";

export type LifecycleCallback = () => TBlackHole;
export type LifecyclePrioritizedCallback = [
  callback: LifecycleCallback,
  priority: number,
];
export type CallbackList = LifecyclePrioritizedCallback[];

export type TLifeCycleRegister = (
  callback: LifecycleCallback,
  priority?: number,
) => void;

export type TLifecycleBase = {
  /**
   * Registers a callback for the bootstrap phase, executed during the initial startup process.
   */
  onBootstrap: TLifeCycleRegister;

  /**
   * Registers a callback for immediately after the configuration phase, allowing post-configuration adjustments.
   */
  onPostConfig: TLifeCycleRegister;

  /**
   * Registers a callback for the pre-initialization phase, executed before the main initialization starts.
   */
  onPreInit: TLifeCycleRegister;

  /**
   * Registers a callback for when the system is fully initialized and ready.
   */
  onReady: TLifeCycleRegister;

  /**
   * Notification that the application intends to shut down.
   */
  onPreShutdown: TLifeCycleRegister;

  /**
   * Begins the shutdown process, typically invoked when the system is about to shut down.
   */
  onShutdownStart: TLifeCycleRegister;

  /**
   * Completes the shutdown process, executed after all shutdown procedures are complete.
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
