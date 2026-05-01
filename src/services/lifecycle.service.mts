import type { LifecycleCallback, LifecycleStages, TLifecycleBase } from "../index.mts";
import { DOWN, each, eachSeries, LIFECYCLE_STAGES, UP } from "../index.mts";
import { is } from "./is.service.mts";

type EventMapObject = {
  callback: LifecycleCallback;
  priority: number;
};
const PRE_CALLBACKS_START = 0;
const DECIMALS = 2;

/**
 * Lifecycle event registry for per-bootstrap stage callbacks.
 *
 * @remarks
 * Creates and owns a Map of lifecycle stage names to callback lists. Exposes
 * seven hook attachment methods (`onPreInit`, `onPostConfig`, etc.) that queue
 * callbacks for later execution. The returned `exec()` method is called by the
 * wiring engine at each stage to fire callbacks in strict order: positive
 * priorities (high to low), unprioritized (any order), negative priorities
 * (high to low). Each stage is fired only once; subsequent attaches on a stage
 * that has already executed fire the callback immediately.
 */
export function CreateLifecycle() {
  const events = new Map(
    LIFECYCLE_STAGES.map((event): [LifecycleStages, EventMapObject[]] => [event, []]),
  );

  /**
   * Attach a callback to a named lifecycle stage with optional priority.
   *
   * @remarks
   * If the stage has not yet been stored in the map (already executed), the
   * callback fires immediately unless it is a Shutdown stage (which are never
   * re-fired after they have been executed).
   */
  function attachEvent(callback: LifecycleCallback, name: LifecycleStages, priority?: number) {
    const stageList = events.get(name);
    // stage already executed (not in the map) — fire immediately unless Shutdown
    if (!is.array(stageList)) {
      if (!name.includes("Shutdown")) {
        callback();
      }
      return;
    }
    // stage is still pending; queue the callback with its priority
    stageList.push({ callback, priority });
  }

  return {
    /**
     * Event hook registry for all seven lifecycle stages.
     */
    events: {
      /**
       * Pre-initialization hook; safe for initial state setup.
       *
       * @remarks
       * Config is not yet loaded; do not read `config.*` at this stage.
       */
      onBootstrap: (callback, priority) => attachEvent(callback, "Bootstrap", priority),
      /**
       * Post-config hook; all configuration is now available.
       */
      onPostConfig: (callback, priority) => attachEvent(callback, "PostConfig", priority),
      /**
       * Pre-initialization hook; config and modules are loaded.
       */
      onPreInit: (callback, priority) => attachEvent(callback, "PreInit", priority),
      /**
       * Pre-shutdown hook; graceful shutdown is beginning.
       */
      onPreShutdown: (callback, priority) => attachEvent(callback, "PreShutdown", priority),
      /**
       * Ready hook; all services are wired and the app is fully running.
       *
       * @remarks
       * This is the stage where schedulers, servers, and long-running tasks begin.
       */
      onReady: (callback, priority) => attachEvent(callback, "Ready", priority),
      /**
       * Shutdown-complete hook; cleanup is done.
       */
      onShutdownComplete: (callback, priority) =>
        attachEvent(callback, "ShutdownComplete", priority),
      /**
       * Shutdown-start hook; active connections are closing.
       */
      onShutdownStart: (callback, priority) => attachEvent(callback, "ShutdownStart", priority),
    } satisfies TLifecycleBase as TLifecycleBase,
    /**
     * Execute all callbacks for a named lifecycle stage in strict order.
     *
     * @remarks
     * Splits callbacks by priority: positive (high to low), unprioritized (any
     * order), negative (high to low). Runs positive and negative series in order,
     * unprioritized in parallel. Removes the stage from the map after execution
     * so that late-attaching callbacks to an executed stage fire immediately.
     *
     * @returns Execution duration in milliseconds.
     */
    async exec(stage: LifecycleStages): Promise<string> {
      const start = performance.now();
      const list = events.get(stage);
      events.delete(stage);
      if (!is.empty(list)) {
        const sorted = list.filter(({ priority }) => priority !== undefined);
        const quick = list.filter(({ priority }) => priority === undefined);
        const positive = [] as EventMapObject[];
        const negative = [] as EventMapObject[];

        // segregate sorted callbacks into positive and negative priority buckets
        sorted.forEach(i => {
          if (i.priority >= PRE_CALLBACKS_START) {
            positive.push(i);
            return;
          }
          negative.push(i);
        });

        // execute positive priorities in descending order (high to low)
        await eachSeries(
          positive.toSorted((a, b) => (a.priority < b.priority ? UP : DOWN)),
          async ({ callback }) => await callback(),
        );

        // execute unprioritized callbacks in parallel
        await each(quick, async ({ callback }) => await callback());

        // execute negative priorities in descending order (-1 to -1000)
        await eachSeries(
          negative.toSorted((a, b) => (a.priority < b.priority ? UP : DOWN)),
          async ({ callback }) => await callback(),
        );
      }
      return `${(performance.now() - start).toFixed(DECIMALS)}ms`;
    },
  };
}
