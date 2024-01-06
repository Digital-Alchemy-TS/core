import { DOWN, each, eachSeries, UP, ZCC } from "@zcc/utilities";

import { AbstractConfig } from "../helpers/config.helper.mjs";
import {
  BootstrapException,
  InternalError,
} from "../helpers/errors.helper.mjs";
import { ZCCApplicationDefinition } from "./application.extension.mjs";

const NONE = -1;

export type LifecycleCallback = () => void | Promise<void>;
export type CallbackList = [LifecycleCallback, number][];

export type TChildLifecycle = {
  attach: () => Promise<void>;
  isAttached: () => boolean;
  onAttach: (callback: LifecycleCallback) => void;
  onBootstrap: (callback: LifecycleCallback, priority?: number) => void;
  onConfig: (callback: LifecycleCallback, priority?: number) => void;
  onPostConfig: (callback: LifecycleCallback, priority?: number) => void;
  onPreInit: (callback: LifecycleCallback, priority?: number) => void;
  onReady: (callback: LifecycleCallback, priority?: number) => void;
};

export function CreateLifecycle() {
  let bootstrapCallbacks: CallbackList = [];
  let configCallbacks: CallbackList = [];
  let postConfigCallbacks: CallbackList = [];
  let preInitCallbacks: CallbackList = [];
  let readyCallbacks: CallbackList = [];
  let completedCallbacks = new Set<string>();

  /**
   * Run the callbacks with defined priorities first.
   * These should be done in order
   *
   * Next, run all the callbacks without defined priorities.
   * These are run in parallel
   */
  async function RunCallbacks(list: CallbackList, name: string) {
    completedCallbacks.add(name);
    const sorted = list.filter(([, sort]) => sort !== NONE);
    const quick = list.filter(([, sort]) => sort === NONE);
    await eachSeries(
      sorted.sort(([, a], [, b]) => (a > b ? UP : DOWN)),
      async ([callback]) => await callback(),
    );
    await each(quick, async ([callback]) => await callback());
  }

  let configuredApplication: ZCCApplicationDefinition;
  let started = false;

  return {
    // eslint-disable-next-line sonarjs/cognitive-complexity
    child: (): TChildLifecycle => {
      let childBootstrapCallbacks: CallbackList = [];
      let childConfigCallbacks: CallbackList = [];
      let childPostConfigCallbacks: CallbackList = [];
      let childPreInitCallbacks: CallbackList = [];
      let childReadyCallbacks: CallbackList = [];
      const onAttachCallbacks: LifecycleCallback[] = [];
      let isAttached = false;

      return {
        attach: async () => {
          isAttached = true;
          bootstrapCallbacks.push(...childBootstrapCallbacks);
          childBootstrapCallbacks = bootstrapCallbacks;
          configCallbacks.push(...childConfigCallbacks);
          childConfigCallbacks = configCallbacks;
          postConfigCallbacks.push(...childPostConfigCallbacks);
          childPostConfigCallbacks = postConfigCallbacks;
          preInitCallbacks.push(...childPreInitCallbacks);
          childPreInitCallbacks = preInitCallbacks;
          readyCallbacks.push(...childReadyCallbacks);
          childReadyCallbacks = readyCallbacks;

          await each(onAttachCallbacks, async callback => await callback());
        },
        isAttached: () => isAttached,
        onAttach: (callback: LifecycleCallback) => {
          if (isAttached) {
            ZCC.systemLogger.warn("[onAttach] late attach");
            if (started) {
              setImmediate(async () => await callback());
            }
          }
          onAttachCallbacks.push(callback);
        },
        onBootstrap: (callback: LifecycleCallback, priority = NONE) => {
          if (isAttached) {
            ZCC.systemLogger.warn("[onBootstrap] late attach");
            if (started) {
              setImmediate(async () => await callback());
            }
          }
          childBootstrapCallbacks.push([callback, priority]);
        },
        onConfig: (callback: LifecycleCallback, priority = NONE) => {
          if (isAttached) {
            ZCC.systemLogger.warn("[onConfig] late attach");
            if (started) {
              setImmediate(async () => await callback());
            }
          }
          childConfigCallbacks.push([callback, priority]);
        },
        onPostConfig: (callback: LifecycleCallback, priority = NONE) => {
          if (isAttached) {
            ZCC.systemLogger.warn("[onPostConfig] late attach");
            if (started) {
              setImmediate(async () => await callback());
            }
          }
          childPostConfigCallbacks.push([callback, priority]);
        },
        onPreInit: (callback: LifecycleCallback, priority = NONE) => {
          if (isAttached) {
            ZCC.systemLogger.warn("[onPreInit] late attach");
            if (started) {
              setImmediate(async () => await callback());
            }
          }
          childPreInitCallbacks.push([callback, priority]);
        },
        onReady: (callback: LifecycleCallback, priority = NONE) => {
          if (isAttached) {
            ZCC.systemLogger.warn("[onReady] late attach");
            if (started) {
              setImmediate(async () => await callback());
            }
          }
          childReadyCallbacks.push([callback, priority]);
        },
      };
    },
    exec(): Promise<void> {
      if (!ZCC.application) {
        throw new BootstrapException(
          "Create",
          "NO_APPLICATION",
          "Call init first",
        );
      }
      return new Promise(done => {
        setImmediate(async () => {
          const logger = ZCC.systemLogger;
          try {
            logger.debug("Bootstrap started");

            // Run actions before any configuration or major initialization
            logger.trace("Running preInit callbacks");
            await RunCallbacks(preInitCallbacks, "onBootstrap");

            // Configuration loading phase
            logger.trace("Loading configuration");

            logger.trace("Running config callbacks");
            await RunCallbacks(configCallbacks, "onConfig");

            // Actions right after configuration but before the main application bootstrapping
            logger.trace("Running postConfig callbacks");
            await RunCallbacks(postConfigCallbacks, "onPostConfig");

            // Main bootstrapping phase
            logger.trace("Running bootstrap callbacks");
            await RunCallbacks(bootstrapCallbacks, "onPreInit");

            // Application is fully initialized and operational
            logger.trace("Running ready callbacks");
            await RunCallbacks(readyCallbacks, "onReady");

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
            started = true;
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
      // console.log(chalk.magenta("merge config"), config);
      ZCC.config.merge(config);
      // console.log(chalk.magenta.bold("updated"), ZCC.config.configuration());
      await ZCC.config.loadConfig();
    },
    onBootstrap: (callback: LifecycleCallback, priority = NONE) => {
      if (completedCallbacks.has("onBootstrap")) {
        ZCC.systemLogger.warn("[onBootstrap] late attach");
        setImmediate(async () => await callback());
      }
      bootstrapCallbacks.push([callback, priority]);
    },
    onConfig: (callback: LifecycleCallback, priority = NONE) => {
      if (completedCallbacks.has("onConfig")) {
        ZCC.systemLogger.warn("[onConfig] late attach");
        setImmediate(async () => await callback());
      }
      configCallbacks.push([callback, priority]);
    },
    onPostConfig: (callback: LifecycleCallback, priority = NONE) => {
      if (completedCallbacks.has("onPostConfig")) {
        ZCC.systemLogger.warn("[onPostConfig] late attach");
        setImmediate(async () => await callback());
      }
      postConfigCallbacks.push([callback, priority]);
    },
    onPreInit: (callback: LifecycleCallback, priority = NONE) => {
      if (completedCallbacks.has("onPreInit")) {
        ZCC.systemLogger.warn("[onPreInit] late attach");
        setImmediate(async () => await callback());
      }
      preInitCallbacks.push([callback, priority]);
    },
    onReady: (callback: LifecycleCallback, priority = NONE) => {
      if (completedCallbacks.has("onReady")) {
        ZCC.systemLogger.warn("[onReady] late attach");
        setImmediate(async () => await callback());
      }
      readyCallbacks.push([callback, priority]);
    },
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
      completedCallbacks = new Set<string>();
      bootstrapCallbacks = [];
      configCallbacks = [];
      postConfigCallbacks = [];
      preInitCallbacks = [];
      readyCallbacks = [];
      started = false;
    },
  };
}

export type TLifeCycle = ReturnType<typeof CreateLifecycle>;
