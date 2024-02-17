import Obj from "object-path";
import { v4 } from "uuid";

import { TServiceParams } from "../../boilerplate";
import { is, sleep, ZCC } from "../../utilities";
import {
  ActiveWatcher,
  GenericFilter,
  SEQUENCE_MATCHER_ERRORS,
  SEQUENCE_MATCHER_EXECUTION_COUNT,
  SEQUENCE_MATCHER_EXECUTION_TIME,
  SequenceWatchOptions,
  TrackedOptions,
} from "..";

// eslint-disable-next-line @typescript-eslint/unbound-method
const { get } = Obj;

export function SequenceWatcher({ logger, hass, config }: TServiceParams) {
  const ACTIVE = new Map<object, ActiveWatcher>();
  const WATCHED_EVENTS = new Map<string, TrackedOptions[]>();
  const EVENT_REMOVAL = new Map<string, () => void>();

  async function onMatch(data: SequenceWatchOptions) {
    await data.exec();
    const reset = data.reset ?? "self";
    if (reset === "self") {
      ACTIVE.delete(data);
      return;
    }
    if (!is.object(reset)) {
      logger.error({ reset: data.reset }, `bad reset type`);
      return;
    }
    const labels = new Set([reset.label].flat().filter(i => !is.empty(i)));
    [...ACTIVE.keys()].forEach(key => {
      const item = ACTIVE.get(key);
      if (labels.has(item.label)) {
        item.interrupt.kill("stop");
        ACTIVE.delete(key);
      }
    });
  }

  function trigger(type: string, event_data: object): void {
    WATCHED_EVENTS.get(type).forEach(async data => {
      const allowed = data.filter(event_data);
      if (!allowed) {
        return;
      }

      // * Identify if it is already being watched
      const current = ACTIVE.get(data);
      const match = [];
      if (current) {
        // if so, kill the current sleep so it doesn't gc early
        current.interrupt.kill("stop");
        // prepend the current matches in to the new list
        match.push(...current.match);
      }

      // * Grab the new value from the event, and add it on the list
      const value = get(event_data, data.path);
      match.push(value);

      // * If the sequence matches, fire the callback
      if (is.equal(match, data.match)) {
        await onMatch(data);
      }

      // * wait out the match timeout using a sleep that can be cancelled
      const interrupt = sleep(config.automation.SEQUENCE_TIMEOUT);
      ACTIVE.set(data, {
        interrupt,
        label: data.label,
        match,
        reset: data.reset,
      });
      await interrupt;

      // * New event hasn't come in within time period. >>> GC
      ACTIVE.delete(data);
    });
  }

  function SequenceWatcher<
    DATA extends object = object,
    MATCH extends string = string,
  >(data: SequenceWatchOptions<DATA, MATCH>) {
    const { exec, event_type, match, context, label, path, filter } = data;
    logger.trace({ context }, `setting up sequence watcher`);
    const id = v4();

    // If this is the first watcher for this event, set up a listener
    let watcher = WATCHED_EVENTS.get(event_type);
    if (!watcher) {
      watcher = [];
      logger.trace({ event_type }, `listening for socket event`);
      const remover = hass.socket.onEvent({
        context,
        event: event_type,
        exec: eventData => trigger(event_type, eventData),
        label,
      });
      EVENT_REMOVAL.set(event_type, remover);
    }

    // Append watcher to list
    WATCHED_EVENTS.set(event_type, [
      ...watcher,
      {
        context,
        event_type,
        exec: () => {
          logger.trace({ context, label, match }, `sequence match trigger`);
          setImmediate(
            async () =>
              await ZCC.safeExec({
                duration: SEQUENCE_MATCHER_EXECUTION_TIME,
                errors: SEQUENCE_MATCHER_ERRORS,
                exec: async () => await exec(),
                executions: SEQUENCE_MATCHER_EXECUTION_COUNT,
                labels: { context, label },
              }),
          );
        },
        filter: filter as GenericFilter,
        id,
        label,
        match,
        path,
      },
    ]);

    // Return a removal function
    return () => {
      const watcher = WATCHED_EVENTS.get(event_type).filter(
        item => item.id !== id,
      );
      if (is.empty(watcher)) {
        logger.debug(
          { event_type },
          `last watcher for event removed, cleaning up socket event listener`,
        );
        WATCHED_EVENTS.delete(event_type);
        EVENT_REMOVAL.get(event_type)();
        EVENT_REMOVAL.delete(event_type);
        return;
      }
      WATCHED_EVENTS.set(event_type, watcher);
    };
  }

  return SequenceWatcher;
}
