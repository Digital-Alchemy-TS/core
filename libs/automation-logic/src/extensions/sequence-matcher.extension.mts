import { TServiceParams } from "@zcc/boilerplate";
import { sleep } from "@zcc/utilities";

import { LIB_AUTOMATION_LOGIC } from "../automation-logic.module.mjs";
import { SequenceWatchOptions } from "../helpers/sequence.helper.mjs";

export function SequenceWatcher({
  logger,
  context,
  lifecycle,
  getApis,
}: TServiceParams) {
  const automation = getApis(LIB_AUTOMATION_LOGIC);
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
  const WATCHED_EVENTS = new Map<string, SequenceWatcher[]>();

  // protected onModuleInit(): void {
  //   this.scanner.bindMethodDecorator<SequenceWatchDTO>(
  //     SequenceWatcher,
  //     ({ context, exec, data }) => {
  //       this.logger.info(
  //         { context, match: data.match },
  //         is.empty(data.context)
  //           ? `[@SequenceWatcher]`
  //           : `[@SequenceWatcher]({%s})`,
  //         data.context,
  //       );
  //       let watcher = this.WATCHED_EVENTS.get(data.event_type);
  //       if (!watcher) {
  //         watcher = [];
  //         this.watchEvent(data.event_type);
  //       }
  //       watcher.push({
  //         ...data,
  //         callback: async () => {
  //           this.logger.trace(
  //             { context, match: data.match },
  //             is.empty(data.context)
  //               ? `[@SequenceWatcher] trigger`
  //               : `[@SequenceWatcher]({%s}) trigger`,
  //             data.context,
  //           );
  //           const start = Date.now();
  //           await exec();
  //           this.event.emit(SEQUENCE_WATCHER_TRIGGER, {
  //             context: data.context,
  //             label: data.label,
  //             time: Date.now() - start,
  //           } as SequenceWatcherTriggerData);
  //         },
  //       });
  //       this.WATCHED_EVENTS.set(data.event_type, watcher);
  //     },
  //   );
  // }

  // private cleanTags(reset: string): void {
  //   [...this.ACTIVE.keys()].forEach(key => {
  //     const item = this.ACTIVE.get(key);
  //     if (item.reset === reset) {
  //       item.interrupt.kill("stop");
  //       this.ACTIVE.delete(key);
  //     }
  //   });
  // }

  // private onMatch(data: SequenceWatcher): void {
  //   nextTick(async () => await data.callback());
  //   const reset = data.reset ?? "none";
  //   if (reset === "self") {
  //     this.ACTIVE.delete(data);
  //   }
  //   if (reset.startsWith("tag")) {
  //     // Retrieve everything with the same tag, and remove them all
  //     // (will include self)
  //     this.cleanTags(reset);
  //   }
  // }

  // private trigger(type: string, event_data: object): void {
  //   this.WATCHED_EVENTS.get(type).forEach(async data => {
  //     const allowed = data.filter(event_data);
  //     if (!allowed) {
  //       return;
  //     }

  //     // * Identify if it is already being watched
  //     const current = this.ACTIVE.get(data);
  //     const match = [];
  //     if (current) {
  //       // if so, kill the current sleep so it doesn't gc early
  //       current.interrupt.kill("stop");
  //       // prepend the current matches in to the new list
  //       match.push(...current.match);
  //     }

  //     // * Grab the new value from the event, and add it on the list
  //     const value = get(event_data, data.path);
  //     match.push(value);

  //     // * If the sequence matches, fire the callback
  //     if (is.equal(match, data.match)) {
  //       this.onMatch(data);
  //     }

  //     // * wait out the match timeout using a sleep that can be cancelled
  //     const interrupt = sleep(this.matchTimeout);
  //     this.ACTIVE.set(data, { interrupt, match, reset: data.reset });
  //     await interrupt;

  //     // * New event hasn't come in within time period. >>> GC
  //     this.ACTIVE.delete(data);
  //   });
  // }

  // private watchEvent(event_type: string) {
  //   this.logger.debug(`[%s] watching event`, event_type);
  //   OnHassEvent({ event_type }, (event: { data: object }) => {
  //     this.trigger(event_type, event.data);
  //   });
  // }

  function SequenceWatcher(options: SequenceWatchOptions) {
    logger.debug({ context }, `Setting up sequence watcher`);
    //
  }

  return SequenceWatcher;
}
