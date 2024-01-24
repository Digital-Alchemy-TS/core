import { PICK_ENTITY } from "@zcc/home-assistant";
import { CronExpression } from "@zcc/utilities";

export interface ManagedSwitchOptions {
  /**
   * Logging context
   */
  context: string;
  /**
   * Set the state of this switch
   */
  entity_id: PICK_ENTITY<"switch"> | PICK_ENTITY<"switch">[];
  /**
   * cron compatible expression
   *
   * Default: EVERY_10_MINUTES
   */
  schedule?: CronExpression | `${CronExpression}` | string;
  /**
   * Check on update of this entity
   */
  onEntityUpdate?: PICK_ENTITY | PICK_ENTITY[];
  /**
   * Receive updates from configured annotations
   */
  onEvent?: string | string[];
  /**
   * - return true for on
   * - return false for off
   * - return undefined for no change
   */
  shouldBeOn: () => boolean | undefined;
}
