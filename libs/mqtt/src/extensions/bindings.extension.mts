import { TServiceParams } from "@zcc/boilerplate";
import { is } from "@zcc/utilities";
import {
  connectAsync,
  IClientOptions,
  IClientPublishOptions,
  IClientSubscribeOptions,
  ISubscriptionGrant,
  MqttClient,
  Packet,
} from "mqtt";

import { CLIENT_OPTIONS } from "../helpers/config.helper.mjs";
import { MqttSubscribeOptions } from "../helpers/types.helper.mjs";

export type MqttCallback<T = unknown> = (
  payload: T | T[],
  packet?: Packet,
) => void;

const FIRST = 0;

export function MQTT_Bindings({
  logger,
  lifecycle,
  getConfig,
}: TServiceParams) {
  let client: MqttClient;

  const callbacks = new Map<string, [MqttCallback[], MqttSubscribeOptions]>();
  const subscriptions = new Set<string>();

  lifecycle.onPostConfig(async () => {
    const options = getConfig<IClientOptions>(CLIENT_OPTIONS);
    client = await connectAsync({ ...options });
    logger.trace("mqtt connect");
  });

  lifecycle.onBootstrap(() => {
    client.on("message", (topic: string, payload: Buffer, packet: Packet) => {
      const [callbacks, options] = callbacks.get(topic) ?? [];
      if (is.empty(callbacks)) {
        logger.warn(`Incoming MQTT {%s} with no callbacks`, topic);
        return;
      }
      if (!options?.omitIncoming) {
        logger.debug(`Incoming MQTT {%s} (%s)`, topic, callbacks.length);
      }
      callbacks.forEach(callback => {
        callback(handlePayload(payload), packet);
      });
    });
  });

  function listen(
    topics: string | string[],
    options?: IClientSubscribeOptions,
  ): Promise<ISubscriptionGrant[]> {
    return new Promise((resolve, reject) => {
      topics = is.string(topics) ? [topics] : topics;
      topics = topics.filter(topic => !subscriptions.has(topic));
      if (is.empty(topics)) {
        return;
      }
      (topics as string[]).forEach(topic => {
        logger.debug(`Subscribe {%s}`, topic);
        subscriptions.add(topic);
      });
      client.subscribe(topics, options, (error, granted) => {
        if (error) {
          return reject(error);
        }
        resolve(granted);
      });
    });
  }

  function publish(
    topic: string,
    message?: string | Buffer | object | Array<unknown>,
    options?: IClientPublishOptions,
  ): Promise<Packet> {
    return new Promise<Packet>((resolve, reject) => {
      if (is.object(message)) {
        message = JSON.stringify(message);
      }
      client.publish(topic, message ?? "", options, (error, packet) => {
        if (error) {
          return reject(error);
        }
        resolve(packet);
      });
    });
  }

  function subscribe<TYPE>(
    topic: string,
    callback: MqttCallback<TYPE>,
    options?: MqttSubscribeOptions,
  ): void {
    listen(topic, { ...options, qos: 1 });
    const [callbacks, options_] = callbacks.get(topic) ?? [
      [] as MqttCallback[],
      options,
    ];
    callbacks.push(callback);
    callbacks.set(topic, [callbacks, options_]);
  }

  function unlisten(
    topic: string,
    options?: IClientSubscribeOptions,
  ): Promise<Packet> {
    return new Promise<Packet>((resolve, reject) => {
      client.unsubscribe(topic, options, (error, packet) => {
        if (error) {
          return reject(error);
        }
        resolve(packet);
      });
    });
  }

  function handlePayload<T>(payload: Buffer): T {
    const text = payload.toString("utf8");
    if (!["{", "["].includes(text.charAt(FIRST))) {
      return text as unknown as T;
    }
    try {
      return JSON.parse(text);
    } catch {
      logger.warn(`JSON parse failed`);
      return undefined;
    }
  }
}
