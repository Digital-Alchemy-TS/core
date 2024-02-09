export const HASS_ENTITY = "HASS_ENTITY";
export const HASS_ENTITY_GROUP = "HASS_ENTITY_GROUP";
export const ALL_ENTITIES_UPDATED = "ALL_ENTITIES_UPDATED";
export const SOCKET_READY = "SOCKET_READY";
export const ON_SOCKET_AUTH = "ON_SOCKET_AUTH";

export enum HASSIO_WS_COMMAND {
  // Found a use for
  area_list = "config/area_registry/list",
  auth = "auth",
  call_service = "call_service",
  device_list = "config/device_registry/list",
  entity_list_for_display = "config/entity_registry/list_for_display",
  entity_list = "config/entity_registry/list",
  entity_remove = "config/entity_registry/remove",
  registry_update = "config/entity_registry/update",
  get_config = "get_config",
  generate_backup = "backup/generate",
  remove_backup = "backup/remove",
  history_during_period = "history/history_during_period",
  backup_info = "backup/info",
  download_backup = "auth/sign_path",
  get_states = "get_states",
  fire_event = "fire_event",
  ping = "ping",
  registry_get = "config/entity_registry/get",
  render_template = "render_template",
  search_related = "search/related",
  subscribe_trigger = "subscribe_trigger",
  subscribe_events = "subscribe_events",
  // Haven't decided
  core_update = "config/core/update",
  persistent_notification = "persistent_notification/get",
  setup_info = "integration/setup_info",
  system_health = "system_health/info",
  trace_contexts = "trace/contexts",
  unsubscribe_events = "unsubscribe_events",
  // Don't see a use for in library yet
  analytics = "analytics",
  auth_list = "config/auth/list",
  cloud_status = "cloud/status",
  current_user = "auth/current_user",
  get_themes = "frontend/get_themes",
  get_user_data = "frontend/get_user_data",
  lovelace_config = "lovelace/config",
  lovelace_resources = "lovelace/resources",
  network = "network",
  translations = "frontend/get_translations",
}

export enum HassSocketMessageTypes {
  auth_required = "auth_required",
  auth_ok = "auth_ok",
  event = "event",
  result = "result",
  pong = "pong",
  auth_invalid = "auth_invalid",
}

export const HOME_ASSISTANT_MODULE_CONFIGURATION =
  "HOME_ASSISTANT_MODULE_CONFIGURATION";
