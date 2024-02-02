import { sleep, TBlackHole, TContext } from "@zcc/utilities";

export type SequenceWatchOptions<
  DATA extends object = object,
  MATCH extends string = string,
> = {
  /**
   * Additional log context
   */
  context: TContext;

  /**
   * Pre-filter to only events of a given type
   */
  event_type: string;

  /**
   * Code to run on match
   */
  exec: () => TBlackHole;

  /**
   * Pick objects of relevance out of the event stream
   */
  filter: (data: DATA) => boolean;

  /**
   * text label
   *
   * - for metrics
   * - for resetting
   */
  label?: string;

  /**
   * States from controller to match
   */
  match: MATCH[];

  /**
   * "path.to.property"
   */
  path: string;

  /**
   * Normally a watcher must wait 1500 as a "cooling off" / "waiting for more states to match with to come in"
   *
   * - `self`: after activating, reset the progress of this particular activate event so it can re-activate immediately
   *
   * - `tag:${string}`: reset ALL sequence watchers that share the same tag
   */
  reset?: TSequenceReset;
};

export type TSequenceReset = "self" | { label: string | string[] };
export type ActiveWatcher = {
  interrupt: ReturnType<typeof sleep>;
  match: string[];
  label: string;
  reset: TSequenceReset;
};
export type TrackedOptions = SequenceWatchOptions & {
  id: string;
};

export type GenericFilter = (data: object) => boolean;
