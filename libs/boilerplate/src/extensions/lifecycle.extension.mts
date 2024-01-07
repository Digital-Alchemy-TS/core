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

const NONE = -1;
// ! This is a sorted array! Don't change the order
const LIFECYCLE_STAGES = [
  "PreInit",
  "Config",
  "PostConfig",
  "Bootstrap",
  "Ready",
];

export function CreateLifecycle(): TParentLifecycle {
  let completedCallbacks = new Set<string>();
  let configuredApplication: ZCCApplicationDefinition;
  let started = false;

  const parentCallbacks = Object.fromEntries(
    LIFECYCLE_STAGES.map(i => [i, []]),
  );

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

  return {
    ...Object.fromEntries(
      LIFECYCLE_STAGES.map(stage => [
        `on${stage}`,
        (callback: LifecycleCallback, priority = NONE) => {
          if (completedCallbacks.has(`on${stage}`)) {
            ZCC.systemLogger.warn(`[on${stage}] late attach`);
            if (started) {
              setImmediate(async () => await callback());
            }
          }
          parentCallbacks[stage].push([callback, priority]);
        },
      ]),
    ),
    child: (): TChildLifecycle => {
      let isAttached = false;
      const childCallbacks = Object.fromEntries(
        [...LIFECYCLE_STAGES, "Register"].map(i => [i, []]),
      );
      return {
        ...Object.fromEntries(
          [...LIFECYCLE_STAGES, "Register"].map(stage => [
            `on${stage}`,
            (callback: LifecycleCallback, priority = NONE) => {
              if (isAttached) {
                ZCC.systemLogger.warn(`[on${stage}] late attach`);
                if (started) {
                  console.trace();
                  setImmediate(async () => await callback());
                }
              }
              if (childCallbacks[stage]) {
                childCallbacks[stage].push([callback, priority]);
              } else {
                console.error(stage, "WTF?!");
              }
            },
          ]),
        ),
        isRegistered: () => isAttached,
        register: async () => {
          isAttached = true;
          LIFECYCLE_STAGES.forEach(stage => {
            parentCallbacks[stage].push(...childCallbacks[stage]);
            childCallbacks[stage] = parentCallbacks[stage];
          });
        },
      } as TChildLifecycle;
    },
    exec: async () => {
      if (!ZCC.application) {
        throw new BootstrapException(
          "Create",
          "NO_APPLICATION",
          "Call init first",
        );
      }
      try {
        ZCC.systemLogger.debug("Bootstrap started");
        await eachSeries(LIFECYCLE_STAGES, async stage => {
          ZCC.systemLogger.trace(`Running %s callbacks`, stage.toLowerCase());
          await RunCallbacks(parentCallbacks[stage], `on${stage}`);
        });
        ZCC.systemLogger.info("[%s] Started!", ZCC.application.name);
      } catch (error) {
        ZCC.systemLogger.fatal(
          { application: ZCC.application, error },
          "Bootstrap failed",
        );
        // eslint-disable-next-line no-console
        console.error(error);
      } finally {
        started = true;
      }
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
      application.lifecycle.register();
      ZCC.config.merge(config);
      await ZCC.config.loadConfig();
    },
    teardown: async () => {
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
    },
  } as TParentLifecycle;
}

export type TLifeCycle = ReturnType<typeof CreateLifecycle>;
