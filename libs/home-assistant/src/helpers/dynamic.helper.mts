export const PROXY_SERVICE_LIST_UPDATED = "PROXY_SERVICE_LIST_UPDATED";

// Suggest a better name if you got it
export const CALL_PROXY_PROXY_COMMAND = "CALL_PROXY_PROXY_COMMAND";
export type CallProxyCommandData = {
  domain: string;
  service: string;
};

export const HASS_CALENDAR_SEARCH = "HASS_CALENDAR_SEARCH";
export const HASS_CALL_SERVICE = "HASS_CALL_SERVICE";
export type CallServiceCommandData = CallProxyCommandData & {
  type: "fetch" | "socket";
};

export const HASS_SEND_WEBHOOK = "HASS_SEND_WEBHOOK";
export type HassSendWebhookData = {
  name: string;
};

export const HASS_WEBSOCKET_CONNECT = "HASS_WEBSOCKET_CONNECT";
export const HASS_WEBSOCKET_SEND_MESSAGE = "HASS_WEBSOCKET_SEND_MESSAGE";
export type HassWebsocketSendMessageData = {
  type: string;
};

export const HASS_WEBSOCKET_RECEIVE_MESSAGE = "HASS_WEBSOCKET_RECEIVE_MESSAGE";
export type HassWebsocketReceiveMessageData = {
  type: string;
};

export const HASS_ONUPDATE_EVENT = "HASS_ONUPDATE_EVENT";
export type HassOnUpdateEventData = {
  context: string;
  entity_id: string;
  time: number;
};

export const HASS_ONBACKUP = "HASS_ONBACKUP";
export type HassOnBackupData = {
  time: number;
};

export const HASS_ONMESSAGE_CALLBACK = "HASS_ONMESSAGE_CALLBACK";
export type HassOnMessageCallbackData = {
  context: string;
  event: string;
  time: number;
};
