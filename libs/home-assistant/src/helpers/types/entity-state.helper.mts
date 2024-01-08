import { ENTITY_STATE, PICK_ENTITY } from "./utility.helper.mjs";

export enum HassEvents {
  state_changed = "state_changed",
  hue_event = "hue_event",
}

export class ContextDTO {
  public id: string;
  public parent_id: string;
  public user_id: string;
}

type GenericEntityAttributes = {
  /**
   * Entity groups
   */
  entity_id?: PICK_ENTITY[];
  /**
   * Human readable name
   */
  friendly_name?: string;
};

export class GenericEntityDTO<
  ATTRIBUTES extends object = GenericEntityAttributes,
  STATE extends unknown = string,
> {
  public attributes: ATTRIBUTES;
  public context: ContextDTO;
  // ! DO NOT TIE THIS `PICK_ENTITY` BACK TO ALL_DOMAINS
  // Causes circular references, which results in entity definitions always being `any`
  public entity_id: PICK_ENTITY;
  public last_changed: string;
  public last_updated: string;
  public state: STATE;
}

export declare class EventDataDTO<ID extends PICK_ENTITY = PICK_ENTITY> {
  entity_id?: ID;
  event?: number;
  id?: string;
  new_state?: ENTITY_STATE<ID>;
  old_state?: ENTITY_STATE<ID>;
}
export declare class HassEventDTO<ID extends PICK_ENTITY = PICK_ENTITY> {
  context: ContextDTO;
  data: EventDataDTO<ID>;
  event_type: HassEvents;
  origin: "local";
  result?: string;
  time_fired: Date;
  variables: Record<string, unknown>;
}
