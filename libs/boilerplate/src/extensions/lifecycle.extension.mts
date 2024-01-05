import { DOWN, each, eachSeries, UP, ZCC } from "@zcc/utilities";

import { AbstractConfig } from "../helpers/config.helper.mjs";
import {
  BootstrapException,
  InternalError,
} from "../helpers/errors.helper.mjs";
import { ZCCApplicationDefinition } from "./application.extension.mjs";

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

export function CreateLifecycle() {
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

  let configuredApplication: ZCCApplicationDefinition;

  return {
    child: childLifecycle,
    exec(): Promise<void> {
      if (!ZCC.application) {
        throw new BootstrapException(
          "Create",
          "NO_APPLICATION",
          "Call init first",
        );
      }
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

            logger.info("[%s] Started!", ZCC.application.name);
          } catch (error) {
            logger.fatal(
              { application: ZCC.application, error },
              `Bootstrap failed`,
            );
            // Be noisy, this is a fatal error at bootstrap
            // eslint-disable-next-line no-console
            console.error(error);
          } finally {
            done();
          }
        });
      });
    },
    init: async (
      application: ZCCApplicationDefinition,
      config: Partial<AbstractConfig> = {},
    ) => {
      if (ZCC.application) {
        throw new BootstrapException(
          "Create",
          "MULTIPLE_APPLICATIONS",
          "Teardown old application first",
        );
      }
      ZCC.application = application;
      configuredApplication = application;
      ZCC.config.merge(config);
      await ZCC.config.loadConfig();
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
    teardown: () => {
      if (!configuredApplication) {
        // task failed successfully
        return;
      }
      if (ZCC.application !== configuredApplication) {
        throw new InternalError(
          "lifecycle.extension",
          "TEARDOWN_FOREIGN_APPLICATION",
          "ZCC.application points to an application different from the one created by this object",
        );
      }
      ZCC.application = undefined;
      configuredApplication = undefined;
    },
  };
}
