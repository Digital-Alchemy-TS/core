import { ZCCApplicationDefinition } from "../extensions/application.extension.mjs";
import { AbstractConfig } from "./config.helper.mjs";

export type LifecycleCallback = () => void | Promise<void>;
export type CallbackList = [LifecycleCallback, number][];

export type TLifecycleBase = {
  /**
   * Registers a callback for the bootstrap phase, executed during the initial startup process.
   */
  onBootstrap: (callback: LifecycleCallback, priority?: number) => void;

  /**
   * Registers a callback for the configuration phase, executed when the system is configuring its components.
   */
  onConfig: (callback: LifecycleCallback, priority?: number) => void;

  /**
   * Registers a callback for immediately after the configuration phase, allowing post-configuration adjustments.
   */
  onPostConfig: (callback: LifecycleCallback, priority?: number) => void;

  /**
   * Registers a callback for the pre-initialization phase, executed before the main initialization starts.
   */
  onPreInit: (callback: LifecycleCallback, priority?: number) => void;

  /**
   * Registers a callback for when the system is fully initialized and ready.
   */
  onReady: (callback: LifecycleCallback, priority?: number) => void;

  /**
   * Begins the shutdown process, typically invoked when the system is about to shut down.
   */
  onShutdownStart: (callback: LifecycleCallback, priority?: number) => void;

  /**
   * Completes the shutdown process, executed after all shutdown procedures are complete.
   */
  onShutdownComplete: (callback: LifecycleCallback, priority?: number) => void;

  /**
   * Cleans up resources and detaches the child lifecycle from the parent, executed as part of the shutdown sequence.
   */
  teardown: () => Promise<void>;
};

export type TChildLifecycle = TLifecycleBase & {
  /**
   * Registers a callback to be executed when the child lifecycle is registered.
   */
  onRegister: (callback: LifecycleCallback) => void;

  /**
   * Registers the child lifecycle with the parent, ensuring callbacks added to the child are executed in sync with the parent lifecycle stages.
   */
  register: () => Promise<void>;

  /**
   * Checks if the child lifecycle is already registered with the parent.
   */
  isRegistered: () => boolean;
};

export type TParentLifecycle = TLifecycleBase & {
  exec: () => Promise<void>;
  init: (
    application: ZCCApplicationDefinition,
    config: Partial<AbstractConfig>,
  ) => Promise<void>;
  child: () => TChildLifecycle;
};
