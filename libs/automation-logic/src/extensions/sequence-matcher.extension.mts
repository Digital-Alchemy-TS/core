import { TServiceParams } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/home-assistant";
import { is, sleep } from "@zcc/utilities";
import { exec } from "child_process";

import { LIB_AUTOMATION_LOGIC } from "../automation-logic.module.mjs";
import {
  SEQUENCE_WATCHER_TRIGGER,
  SequenceWatcherTriggerData,
} from "../helpers/events.helper.mjs";
import { SequenceWatchOptions } from "../helpers/sequence.helper.mjs";

export function SequenceWatcher({
  logger,
  context,
  lifecycle,
  getApis,
}: TServiceParams) {
  const automation = getApis(LIB_AUTOMATION_LOGIC);
  const hass = getApis(LIB_HOME_ASSISTANT);
  let matchTimeout: number;

  lifecycle.onPostConfig(() => {
    matchTimeout = LIB_AUTOMATION_LOGIC.getConfig("SEQUENCE_TIMEOUT");
  });

  const ACTIVE = new Map<
    object,
    {
      interrupt: ReturnType<typeof sleep>;
      match: string[];
      reset: string;
    }
  >();
  const WATCHED_EVENTS = new Map<string, SequenceWatchOptions[]>();

  function watchEvent(event_type: string) {
    logger.debug(`[%s] watching event`, event_type);
    OnHassEvent({ event_type }, (event: { data: object }) => {
      this.trigger(event_type, event.data);
    });
  }

  function SequenceWatcher(data: SequenceWatchOptions) {
    const { exec, event_type, match, context, label } = data;
    logger.debug({ context }, `Setting up sequence watcher`);
    logger.info(
      { context, match },
      is.empty(context) ? `[@SequenceWatcher]` : `[@SequenceWatcher]({%s})`,
      context,
    );
    let watcher = WATCHED_EVENTS.get(event_type);
    if (!watcher) {
      watcher = [];
      watchEvent(event_type);
    }
    watcher.push({
      ...data,
      exec: async () => {
        logger.trace({ context, label, match }, `[SequenceMatch] trigger`);
        await exec();
        // this.event.emit(SEQUENCE_WATCHER_TRIGGER, {
        //   context,
        //   label,
        //   time: Date.now() - start,
        // } as SequenceWatcherTriggerData);
      },
    });
    WATCHED_EVENTS.set(event_type, watcher);
  }

  return SequenceWatcher;
}
