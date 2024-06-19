import {
  DOWN,
  each,
  eachSeries,
  LIFECYCLE_STAGES,
  LifecycleCallback,
  LifecycleStages,
  NONE,
  sleep,
  TLifecycleBase,
  UP,
} from "../helpers";
import { is } from "./is.extension";

type EventMapObject = {
  callback: LifecycleCallback;
  priority: number;
};
const PRE_CALLBACKS_START = 0;

export function CreateLifecycle() {
  const events = new Map<LifecycleStages, EventMapObject[]>(
    LIFECYCLE_STAGES.map((event) => [event, []]),
  );

  function attachEvent(
    callback: LifecycleCallback,
    name: LifecycleStages,
    priority?: number,
  ) {
    const stageList = events.get(name);
    if (!is.array(stageList)) {
      if (!name.includes("Shutdown")) {
        setImmediate(async () => await callback());
      }
      return;
    }
    stageList.push({ callback, priority });
  }

  return {
    events: {
      onBootstrap: (callback, priority) =>
        attachEvent(callback, "Bootstrap", priority),
      onPostConfig: (callback, priority) =>
        attachEvent(callback, "PostConfig", priority),
      onPreInit: (callback, priority) =>
        attachEvent(callback, "PreInit", priority),
      onPreShutdown: (callback, priority) =>
        attachEvent(callback, "PreShutdown", priority),
      onReady: (callback, priority) => attachEvent(callback, "Ready", priority),
      onShutdownComplete: (callback, priority) =>
        attachEvent(callback, "ShutdownComplete", priority),
      onShutdownStart: (callback, priority) =>
        attachEvent(callback, "ShutdownStart", priority),
    } satisfies TLifecycleBase,
    async exec(stage: LifecycleStages): Promise<string> {
      const start = Date.now();
      const list = events.get(stage);
      events.delete(stage);
      if (!is.empty(list)) {
        const sorted = list.filter(({ priority }) => priority !== undefined);
        const quick = list.filter(({ priority }) => priority === undefined);
        const positive = [] as EventMapObject[];
        const negative = [] as EventMapObject[];

        sorted.forEach((i) => {
          if (i.priority >= PRE_CALLBACKS_START) {
            positive.push(i);
            return;
          }
          negative.push(i);
        });

        // * callbacks with a priority greater than 0
        // high to low (1000 => 0)
        await eachSeries(
          positive.sort((a, b) => (a.priority < b.priority ? UP : DOWN)),
          async ({ callback }) => await callback(),
        );

        // * callbacks without a priority
        // any order
        await each(quick, async ({ callback }) => await callback());

        // * callbacks with a priority less than 0
        // high to low (-1 => -1000)
        await eachSeries(
          negative.sort((a, b) => (a.priority < b.priority ? UP : DOWN)),
          async ({ callback }) => await callback(),
        );
      }
      // TODO Update this comment with why this sleep exists
      // I forgot why, but it seems on purpose
      await sleep(NONE);
      return `${Date.now() - start}ms`;
    },
  };
}
