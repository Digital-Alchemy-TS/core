import {
  CallbackList,
  LIFECYCLE_STAGES,
  LifecycleCallback,
  LifecycleStages,
  TLoadableChildLifecycle,
} from "..";
import { ILogger, InternalDefinition } from ".";

export function CreateChildLifecycle(
  internal: InternalDefinition,
  logger: ILogger,
): TLoadableChildLifecycle {
  const childCallbacks = {} as Record<LifecycleStages, CallbackList>;

  const [
    // ! This list must be sorted!
    onPreInit,
    onPostConfig,
    onBootstrap,
    onReady,
    onPreShutdown,
    onShutdownStart,
    onShutdownComplete,
  ] = LIFECYCLE_STAGES.map((stage) => {
    childCallbacks[stage] = [];
    return (callback: LifecycleCallback, priority?: number) => {
      if (internal.boot.completedLifecycleEvents.has(stage)) {
        // this is makes "earliest run time" logic way easier to implement
        // intended mode of operation
        if (["PreInit", "PostConfig", "Bootstrap", "Ready"].includes(stage)) {
          setImmediate(async () => await callback());
          return;
        }
        // What does this mean in reality?
        // Probably a broken unit test, I really don't know what workflow would cause this
        logger.fatal(
          { name: CreateChildLifecycle },
          `on${stage} late attach, cannot attach callback`,
        );
        return;
      }
      childCallbacks[stage].push([callback, priority]);
    };
  });

  return {
    getCallbacks: (stage: LifecycleStages) =>
      childCallbacks[stage] as CallbackList,
    onBootstrap,
    onPostConfig,
    onPreInit,
    onPreShutdown,
    onReady,
    onShutdownComplete,
    onShutdownStart,
  };
}
