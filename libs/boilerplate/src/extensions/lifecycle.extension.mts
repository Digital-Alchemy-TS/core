import { DOWN, each, eachSeries, UP, ZCC } from "@zcc/utilities";

import { AbstractConfig } from "../helpers/config.helper.mjs";
import {
  BootstrapException,
  InternalError,
} from "../helpers/errors.helper.mjs";
import {
  CallbackList,
  LifecycleCallback,
  TChildLifecycle,
  TParentLifecycle,
} from "../helpers/lifecycle.helper.mjs";
import { ZCCApplicationDefinition } from "./application.extension.mjs";
import { ILogger } from "./logger.extension.mjs";

const NONE = -1;
// ! This is a sorted array! Don't change the order
const LIFECYCLE_STAGES = [
  "PreInit",
  "PostConfig",
  "Bootstrap",
  "Ready",
  "ShutdownStart",
  "ShutdownComplete",
];

export function ZCCLifecycle(): TParentLifecycle {
  let completedCallbacks = new Set<string>();
  let configuredApplication: ZCCApplicationDefinition;
  // heisenberg's logger. it's probably here, but maybe not
  let logger: ILogger;
  let started = false;

  const parentCallbacks = Object.fromEntries(
    LIFECYCLE_STAGES.map(i => [i, []]),
  );

  const [
    onPreInit,
    onPostConfig,
    onBootstrap,
    onReady,
    onShutdownStart,
    onShutdownComplete,
  ] = LIFECYCLE_STAGES.map(
    stage =>
      (callback: LifecycleCallback, priority = NONE) => {
        // is maybe here
        if (completedCallbacks.has(`on${stage}`)) {
          // is here!
          logger.warn(`[on${stage}] late attach`);
          if (started) {
            setImmediate(async () => await callback());
          }
        }
        parentCallbacks[stage].push([callback, priority]);
      },
  );

  onPreInit(() => (logger = ZCC.logger.context(`boilerplate:Lifecycle`)));

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

  async function teardown() {
    if (!configuredApplication) {
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
    LIFECYCLE_STAGES.forEach(stage => (parentCallbacks[stage] = []));
    started = false;
  }

  async function init(
    application: ZCCApplicationDefinition,
    config: Partial<AbstractConfig> = {},
  ) {
    if (ZCC.application) {
      throw new BootstrapException(
        "Create",
        "MULTIPLE_APPLICATIONS",
        "Teardown old application first",
      );
    }
    ZCC.application = application;
    configuredApplication = application;
    application.lifecycle.attach();
    ZCC.config.merge(config);
    await ZCC.config.loadConfig();
  }

  async function exec() {
    if (!ZCC.application) {
      throw new BootstrapException(
        "Create",
        "NO_APPLICATION",
        "Call init first",
      );
    }
    try {
      logger.debug("Bootstrap started");
      await eachSeries(LIFECYCLE_STAGES, async stage => {
        logger.trace(`Running %s callbacks`, stage.toLowerCase());
        await RunCallbacks(parentCallbacks[stage], `on${stage}`);
      });
      logger.info("[%s] Started!", ZCC.application.name);
      started = true;
    } catch (error) {
      logger.fatal({ application: ZCC.application, error }, "Bootstrap failed");
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  function child(): TChildLifecycle {
    const stages = [...LIFECYCLE_STAGES];
    let isAttached = false;
    const childCallbacks = Object.fromEntries(stages.map(i => [i, []]));

    const [
      onPreInit,
      onPostConfig,
      onBootstrap,
      onReady,
      onShutdownStart,
      onShutdownComplete,
    ] = LIFECYCLE_STAGES.map(
      stage =>
        (callback: LifecycleCallback, priority = NONE) => {
          if (isAttached) {
            logger.warn(`[on${stage}] late attach`);
            if (started) {
              setImmediate(async () => await callback());
            }
          }
          if (childCallbacks[stage]) {
            childCallbacks[stage].push([callback, priority]);
          }
        },
    );

    return {
      attach: () => {
        if (isAttached) {
          throw new BootstrapException(
            "Create",
            "REPEAT_ATTACH",
            "The attach method for this child lifecycle was called more than once",
          );
        }
        isAttached = true;
        Object.entries(childCallbacks).forEach(([key, value]) => {
          parentCallbacks[key].push(...value);
          childCallbacks[key] = parentCallbacks[key];
        });
      },
      onBootstrap,
      onPostConfig,
      onPreInit,
      onReady,
      onShutdownComplete,
      onShutdownStart,
    };
  }

  const out = {
    child,
    exec,
    init,
    onBootstrap,
    onPostConfig,
    onPreInit,
    onReady,
    onShutdownComplete,
    onShutdownStart,
    teardown,
  } as TParentLifecycle;
  ZCC.lifecycle = out;
  return out;
}
