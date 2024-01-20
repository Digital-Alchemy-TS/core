import { IClientOptions, IClientSubscribeOptions } from "mqtt";

export type MqttMessageTransformer = (payload: Buffer) => unknown;

export interface MqttSubscribeOptions extends Partial<IClientSubscribeOptions> {
  omitIncoming?: boolean;
  topic?: string | string[];
}

export interface MqttSubscriberParameter {
  index: number;
  transform?: "json" | "text" | MqttMessageTransformer;
  type: "payload" | "topic" | "packet" | "params";
}

export interface MqttSubscriber {
  handle: (...parameters) => void;
  options: MqttSubscribeOptions;
  parameters: MqttSubscriberParameter[];
  // provider: unknown;
  regexp: RegExp;
  route: string;
  topic: string;
}

export interface MqttModuleOptions extends IClientOptions {
  /**
   * Global queue subscribe.
   * All topic will be prepend '$queue/' prefix automatically.
   * More information is here:
   * https://docs.emqx.io/broker/latest/cn/advanced/shared-subscriptions.html
   */
  queue?: boolean;
  /**
   * Global shared subscribe.
   * All topic will be prepend '$share/group/' prefix automatically.
   * More information is here:
   * https://docs.emqx.io/broker/latest/cn/advanced/shared-subscriptions.html
   */
  share?: string;
}

export enum MqttEvents {
  connect = "MQTT_CONNECT",
  disconnect = "MQTT_DISCONNECT",
  error = "MQTT_ERROR",
  reconnect = "MQTT_RECONNECT",
  close = "MQTT_CLOSE",
  offline = "MQTT_OFFLINE",
}
