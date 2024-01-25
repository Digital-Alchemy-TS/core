import { TContext } from "@zcc/utilities";

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
  exec: () => Promise<void>;

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
  reset?: "none" | "self" | { label: string | string[] };
};
