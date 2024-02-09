import { Dayjs } from "dayjs";

import { TBlackHole, TContext } from "../..";
import { HASSIO_WS_COMMAND, HassSocketMessageTypes } from "./constants.helper";
import { EntityUpdateEvent } from "./entity-state.helper";
import { ALL_DOMAINS, ENTITY_STATE, PICK_ENTITY } from "./utility.helper";

export interface AreaDTO {
  area_id: string;
  name: string;
}

export interface EntityRegistryItem {
  area_id: string;
  config_entry_id: string;
  device_id: string;
  disabled_by: string;
  entity_id: string;
  icon: string;
  name: string;
  platform: string;
}

export interface DeviceListItemDTO {
  area_id: string;
  config_entries: string[];
  connections: string[][];
  disabled_by: null;
  entry_type: null;
  id: string;
  identifiers: string[];
  manufacturer: string;
  model: string;
  name: string;
  name_by_user: null;
  sw_version: string;
  via_device_id: null;
}

export interface HassNotificationDTO {
  created_at: string;
  message: string;
  notification_id: string;
  status: "unread";
  title: string;
}

export interface SignRequestResponse {
  path: string;
}

export interface SocketMessageDTO {
  error?: Record<string, unknown>;
  event?: EntityUpdateEvent;
  id: string;
  message?: string;
  result?: Record<string, unknown>;
  type: HassSocketMessageTypes;
}

export interface SendSocketMessageDTO {
  access_token?: string;
  disabled_by?: "user";
  domain?: string;
  hidden_by?: "user";
  service?: string;
  service_data?: unknown;
  type: HASSIO_WS_COMMAND | `${HASSIO_WS_COMMAND}`;
}

export interface UpdateEntityMessageDTO<
  DOMAIN extends ALL_DOMAINS = ALL_DOMAINS,
> {
  area_id?: string;
  disabled_by?: "user";
  entity_id: PICK_ENTITY<DOMAIN>;
  hidden_by?: "user";
  icon?: string;
  name: string;
  new_entity_id: PICK_ENTITY<DOMAIN>;
  type: HASSIO_WS_COMMAND.registry_update;
}

export interface RemoveEntityMessageDTO {
  entity_id: PICK_ENTITY;
  type: HASSIO_WS_COMMAND.entity_remove;
}

export interface FindRelatedDTO {
  item_id: string;
  item_type: string;
  type: HASSIO_WS_COMMAND.search_related;
}

export interface RegistryGetDTO {
  entity_id: string;
  type: HASSIO_WS_COMMAND.registry_get;
}

export interface RenderTemplateDTO {
  template: string;
  timeout: number;
  type: HASSIO_WS_COMMAND.render_template;
}

export interface SubscribeTriggerDTO {
  trigger: Record<string, unknown>;
  type: HASSIO_WS_COMMAND.subscribe_trigger;
}

export interface UnsubscribeEventsDTO {
  subscription: number;
  type: HASSIO_WS_COMMAND.unsubscribe_events;
}

export interface SignPathDTO {
  path: string;
  type: HASSIO_WS_COMMAND.download_backup;
}

export interface RemoveBackupDTO {
  slug: string;
  type: HASSIO_WS_COMMAND.remove_backup;
}

export interface EntityHistoryDTO<
  ENTITIES extends PICK_ENTITY[] = PICK_ENTITY[],
> {
  end_time: Date | string | Dayjs;
  entity_ids: ENTITIES;
  minimal_response?: boolean;
  no_attributes?: boolean;
  start_time: Date | string | Dayjs;
  type: HASSIO_WS_COMMAND.history_during_period;
}

export type EntityHistoryResult<
  ENTITY extends PICK_ENTITY = PICK_ENTITY,
  ATTRIBUTES extends object = object,
> = Pick<
  ENTITY_STATE<ENTITY> & { attributes: ATTRIBUTES },
  "attributes" | "state"
> & {
  date: Date;
};

export type SOCKET_MESSAGES = { id?: number } & (
  | FindRelatedDTO
  | RegistryGetDTO
  | RemoveBackupDTO
  | RenderTemplateDTO
  | RemoveEntityMessageDTO
  | SendSocketMessageDTO
  | SignPathDTO
  | SubscribeTriggerDTO
  | UnsubscribeEventsDTO
  | UpdateEntityMessageDTO
  | EntityHistoryDTO
);

export type OnHassEventCallback<T = object> = (event: T) => TBlackHole;

export type OnHassEventOptions<T = object> = {
  context: TContext;
  label?: string;
  exec: OnHassEventCallback<T>;
  event: string;
};
