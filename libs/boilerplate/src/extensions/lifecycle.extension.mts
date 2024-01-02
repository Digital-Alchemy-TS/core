import { DOWN, each, eachSeries, UP, ZCC } from "@zcc/utilities";

import { BootstrapException } from "../helpers/errors.helper.mjs";
import { ZCCApplicationDefinition } from "./application.extension.mjs";
import { AbstractConfig } from "./configuration.extension.mjs";

const NONE = -1;

type LifecycleCallback = () => void | Promise<void>;
export type CallbackList = [LifecycleCallback, number][];

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

export type TChildLifecycle = {
  attach: () => Promise<void>;
  onAttach: (callback: LifecycleCallback) => number;
  onBootstrap: (callback: LifecycleCallback, priority?: number) => number;
  onConfig: (callback: LifecycleCallback, priority?: number) => number;
  onPostConfig: (callback: LifecycleCallback, priority?: number) => number;
  onPreInit: (callback: LifecycleCallback, priority?: number) => number;
  onReady: (callback: LifecycleCallback, priority?: number) => number;
};

function CreateLifecycle() {
  const bootstrapCallbacks: CallbackList = [];
  const configCallbacks: CallbackList = [];
  const postConfigCallbacks: CallbackList = [];
  const preInitCallbacks: CallbackList = [];
  const readyCallbacks: CallbackList = [];

  function childLifecycle(): TChildLifecycle {
    const childBootstrapCallbacks: CallbackList = [];
    const childConfigCallbacks: CallbackList = [];
    const childPostConfigCallbacks: CallbackList = [];
    const childPreInitCallbacks: CallbackList = [];
    const childReadyCallbacks: CallbackList = [];
    const onAttachCallbacks: LifecycleCallback[] = [];

    return {
      attach: async () => {
        bootstrapCallbacks.push(...childBootstrapCallbacks);
        configCallbacks.push(...childConfigCallbacks);
        postConfigCallbacks.push(...childPostConfigCallbacks);
        preInitCallbacks.push(...childPreInitCallbacks);
        readyCallbacks.push(...childReadyCallbacks);
        await each(onAttachCallbacks, async callback => await callback());
      },
      onAttach: (callback: LifecycleCallback) =>
        onAttachCallbacks.push(callback),
      onBootstrap: (callback: LifecycleCallback, priority = NONE) =>
        childBootstrapCallbacks.push([callback, priority]),
      onConfig: (callback: LifecycleCallback, priority = NONE) =>
        childConfigCallbacks.push([callback, priority]),
      onPostConfig: (callback: LifecycleCallback, priority = NONE) =>
        childPostConfigCallbacks.push([callback, priority]),
      onPreInit: (callback: LifecycleCallback, priority = NONE) =>
        childPreInitCallbacks.push([callback, priority]),
      onReady: (callback: LifecycleCallback, priority = NONE) =>
        childReadyCallbacks.push([callback, priority]),
    };
  }

  return {
    child: childLifecycle,
    exec(
      application: ZCCApplicationDefinition,
      config: Partial<AbstractConfig> = {},
    ): Promise<void> {
      if (ZCC.application) {
        // probably needs a reset method somewhere
        throw new BootstrapException(
          "Create",
          "MULTIPLE_APPLICATIONS",
          "@zcc is not intended to run multiple applications from within the same process",
        );
      }
      ZCC.application = application;
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
            await ZCC.config.loadConfig();

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
    application: ZCCApplicationDefinition | undefined;
    lifecycle: ReturnType<typeof CreateLifecycle>;
  }
}

ZCC.lifecycle = CreateLifecycle();
