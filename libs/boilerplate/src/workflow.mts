import { DOWN, each, eachSeries, UP, ZCC } from "@zcc/utilities";

import { AbstractConfig } from "./configuration.mjs";

const NONE = -1;

type LifecycleCallback = () => void | Promise<void>;
type CallbackList = [LifecycleCallback, number][];

/**
 * Run the callbacks with defined priorities first.
 * These should be done in order
 *
 * Next, run all the callbacks without defined priorities.
 * These are run in parallel
 */
async function RunCallbacks(list: CallbackList) {
  const sorted = list.filter(([, sort]) => sort !== NONE);
  const quick = list.filter(([, sort]) => sort === NONE);
  await eachSeries(
    sorted.sort(([, a], [, b]) => (a > b ? UP : DOWN)),
    async ([callback]) => await callback(),
  );
  await each(quick, async ([callback]) => await callback());
}

function CreateLifecycle() {
  const preInitCallbacks: CallbackList = [];
  const bootstrapCallbacks: CallbackList = [];
  const postInitCallbacks: CallbackList = [];
  const readyCallbacks: CallbackList = [];

  return {
    exec(
      application: string,
      config: Partial<AbstractConfig> = {},
    ): Promise<void> {
      return new Promise(() => {
        setImmediate(async done => {
          const logger = ZCC.systemLogger;
          try {
            logger.debug("Bootstrap started");
            logger.trace("running preInit callbacks");
            await RunCallbacks(preInitCallbacks);
            logger.trace("running bootstrap callbacks");
            await RunCallbacks(bootstrapCallbacks);
            logger.trace("running postInit callbacks");
            await RunCallbacks(postInitCallbacks);
            logger.trace("running ready callbacks");
            await RunCallbacks(readyCallbacks);
            logger.info("[%s] Started!", application);
          } catch (error) {
            logger.fatal({ application, error }, `Bootstrap failed`);
            // eslint-disable-next-line no-console
            console.error(error);
          } finally {
            done();
          }
        });
      });
    },
    onBootstrap: (callback: LifecycleCallback, priority = NONE) =>
      bootstrapCallbacks.push([callback, priority]),
    onPostInit: (callback: LifecycleCallback, priority = NONE) =>
      postInitCallbacks.push([callback, priority]),
    onPreInit: (callback: LifecycleCallback, priority = NONE) =>
      preInitCallbacks.push([callback, priority]),
    onReady: (callback: LifecycleCallback, priority = NONE) =>
      readyCallbacks.push([callback, priority]),
  };
}

declare module "@zcc/utilities" {
  export interface ZCC_Definition {
    lifecycle: ReturnType<typeof CreateLifecycle>;
  }
}

ZCC.lifecycle = CreateLifecycle();
