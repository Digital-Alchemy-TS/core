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
  const bootstrapCallbacks: CallbackList = [];
  const configCallbacks: CallbackList = [];
  const postConfigCallbacks: CallbackList = [];
  const preInitCallbacks: CallbackList = [];
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

            // Run actions before any configuration or major initialization
            logger.trace("Running preInit callbacks");
            await RunCallbacks(preInitCallbacks);

            // Configuration loading phase
            logger.trace("Loading configuration");
            ZCC.config.merge(config);
            await ZCC.config.loadConfig(application);

            logger.trace("Running config callbacks");
            await RunCallbacks(configCallbacks);

            // Actions right after configuration but before the main application bootstrapping
            logger.trace("Running postConfig callbacks");
            await RunCallbacks(postConfigCallbacks);

            // Main bootstrapping phase
            logger.trace("Running bootstrap callbacks");
            await RunCallbacks(bootstrapCallbacks);

            // Application is fully initialized and operational
            logger.trace("Running ready callbacks");
            await RunCallbacks(readyCallbacks);

            logger.info("[%s] Started!", application);
          } catch (error) {
            logger.fatal({ application, error }, `Bootstrap failed`);
            // Be noisy, this is a fatal error at bootstrap
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
    onConfig: (callback: LifecycleCallback, priority = NONE) =>
      configCallbacks.push([callback, priority]),
    onPostConfig: (callback: LifecycleCallback, priority = NONE) =>
      postConfigCallbacks.push([callback, priority]),
    onPreInit: (callback: LifecycleCallback, priority = NONE) =>
      preInitCallbacks.push([callback, priority]),
    onReady: (callback: LifecycleCallback, priority = NONE) =>
      readyCallbacks.push([callback, priority]),
  };
}

declare module "@zcc/utilities" {
  export interface ZCCDefinition {
    lifecycle: ReturnType<typeof CreateLifecycle>;
  }
}

ZCC.lifecycle = CreateLifecycle();
