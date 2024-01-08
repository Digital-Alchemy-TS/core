import { InternalError } from "@zcc/boilerplate";
import { SECOND, sleep, START, ZCC } from "@zcc/utilities";
import { exit } from "process";
import WS from "ws";

import {
  BASE_URL,
  CRASH_REQUESTS_PER_SEC,
  RENDER_TIMEOUT,
  RETRY_INTERVAL,
  TOKEN,
  WARN_REQUESTS_PER_SEC,
  WEBSOCKET_URL,
} from "../helpers/config.constants.mjs";
import {
  HASS_WEBSOCKET_RECEIVE_MESSAGE,
  HASS_WEBSOCKET_SEND_MESSAGE,
  HassWebsocketReceiveMessageData,
  HassWebsocketSendMessageData,
} from "../helpers/dynamic.helper.mjs";
import {
  HASSIO_WS_COMMAND,
  HassSocketMessageTypes,
  ON_SOCKET_AUTH,
} from "../helpers/types/constants.helper.mjs";
import {
  SOCKET_MESSAGES,
  SocketMessageDTO,
} from "../helpers/types/websocket.helper.mjs";
import { LIB_HOME_ASSISTANT } from "../home-assistant.module.mjs";

let connection: WS;
const CONNECTION_OPEN = 1;
let CONNECTION_ACTIVE = false;
const CLEANUP_INTERVAL = 5;
const PING_INTERVAL = 10;
let messageCount = START;

export function WebsocketAPI() {
  const logger = LIB_HOME_ASSISTANT.childLogger("websocket-api");
  let token: string;
  let WARN_REQUESTS: number;
  let CRASH_REQUESTS: number;
  let renderTimeout: number;
  let AUTH_TIMEOUT: ReturnType<typeof setTimeout>;
  let baseUrl: string;
  const subscriptionCallbacks = new Map<number, (result) => void>();
  let websocketUrl: string;
  let pingInterval: ReturnType<typeof setInterval>;
  let cleanupInterval: ReturnType<typeof setInterval>;
  let retryInterval: number;
  let MESSAGE_TIMESTAMPS: number[] = [];
  const waitingCallback = new Map<number, (result) => void>();

  LIB_HOME_ASSISTANT.lifecycle.onPostConfig(() => {
    token = LIB_HOME_ASSISTANT.getConfig<string>(TOKEN);
    baseUrl = LIB_HOME_ASSISTANT.getConfig<string>(BASE_URL);
    websocketUrl = LIB_HOME_ASSISTANT.getConfig<string>(WEBSOCKET_URL);
    WARN_REQUESTS = LIB_HOME_ASSISTANT.getConfig<number>(WARN_REQUESTS_PER_SEC);
    CRASH_REQUESTS = LIB_HOME_ASSISTANT.getConfig<number>(
      CRASH_REQUESTS_PER_SEC,
    );
    renderTimeout = LIB_HOME_ASSISTANT.getConfig<number>(RENDER_TIMEOUT);
    retryInterval = LIB_HOME_ASSISTANT.getConfig<number>(RETRY_INTERVAL);
  });

  function teardown() {
    if (!connection) {
      return;
    }
    if (connection.readyState === CONNECTION_OPEN) {
      logger.debug(`Closing current connection`);
      CONNECTION_ACTIVE = false;
      connection.close();
    }
    connection = undefined;
  }

  async function sendMessage<RESPONSE_VALUE extends unknown = unknown>(
    data: SOCKET_MESSAGES,
    waitForResponse = true,
    subscription?: () => void,
  ): Promise<RESPONSE_VALUE> {
    if (!connection) {
      logger.error("Cannot send messages before socket is initialized");
      return undefined;
    }
    countMessage();
    ZCC.event.emit(HASS_WEBSOCKET_SEND_MESSAGE, {
      type: data.type,
    } as HassWebsocketSendMessageData);
    if (data.type !== HASSIO_WS_COMMAND.auth) {
      // You want know how annoying this one was to debug?!
      data.id = messageCount;
    }
    if (connection?.readyState !== WS.OPEN) {
      logger.error({ data }, `Cannot send message, connection is not open`);
      return undefined;
    }
    const json = JSON.stringify(data);
    connection.send(json);
    if (subscription) {
      return data.id as RESPONSE_VALUE;
    }
    if (!waitForResponse) {
      return undefined;
    }
    return new Promise<RESPONSE_VALUE>(done =>
      waitingCallback.set(messageCount, done),
    );
  }

  function countMessage(): void | never {
    messageCount++;
    const now = Date.now();
    MESSAGE_TIMESTAMPS.push(now);
    const count = MESSAGE_TIMESTAMPS.filter(time => time > now - SECOND).length;
    if (count > CRASH_REQUESTS) {
      logger.fatal(`FATAL ERROR: Exceeded {CRASH_REQUESTS_PER_MIN} threshold.`);
      exit();
    }
    if (count > WARN_REQUESTS) {
      logger.warn(
        `Message traffic ${CRASH_REQUESTS}>${count}>${WARN_REQUESTS}`,
      );
    }
  }

  function getUrl() {
    const url = new URL(baseUrl);
    const protocol = url.protocol === `http:` ? `ws:` : `wss:`;
    return (
      websocketUrl ||
      `${protocol}//${url.hostname}${
        url.port ? `:${url.port}` : ``
      }/api/websocket`
    );
  }

  LIB_HOME_ASSISTANT.lifecycle.onReady(() => {
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    pingInterval = setInterval(async () => {
      if (!CONNECTION_ACTIVE) {
        return;
      }
      try {
        const pong = await sendMessage({
          type: HASSIO_WS_COMMAND.ping,
        });
        if (pong) {
          return;
        }
        // Tends to happen when HA resets
        // Resolution is to re-connect when it's up again
        logger.error(`Failed to pong!`);
      } catch (error) {
        logger.error({ error }, `ping error`);
      }
      teardown();
      init();
    }, PING_INTERVAL * SECOND);
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      MESSAGE_TIMESTAMPS = MESSAGE_TIMESTAMPS.filter(
        time => time > now - SECOND,
      );
    }, CLEANUP_INTERVAL * SECOND);
  });
  LIB_HOME_ASSISTANT.lifecycle.onShutdownStart(() => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
    if (pingInterval) {
      clearInterval(pingInterval);
    }
  });

  /**
   * Set up a new websocket connection to home assistant
   */
  async function init(): Promise<void> {
    if (connection) {
      throw new InternalError(
        "WebSocketConnection",
        "ExistingConnection",
        `Destroy the current connection before creating a new one`,
      );
    }
    logger.debug(`[CONNECTION_ACTIVE] = {false}`);
    CONNECTION_ACTIVE = false;
    try {
      messageCount = START;
      connection = new WS(getUrl());
      connection.on("message", message => {
        onMessage(JSON.parse(message.toString()));
      });
      connection.on("error", async error => {
        logger.error({ error: error.message || error }, "Socket error");
        if (!CONNECTION_ACTIVE) {
          await sleep(retryInterval);
          teardown();
          await init();
        }
      });
      return await new Promise(done => {
        connection.once("open", () => done());
      });
    } catch (error) {
      logger.error({ error, url: getUrl() }, `initConnection error`);
    }
  }

  async function subscribeEvents(): Promise<void> {
    // if (!SUBSCRIBE_EVENTS) {
    //   logger.debug(`[Event Subscriptions] skipping`);
    //   return;
    // }
    logger.debug(`[Event Subscriptions] starting`);
    // await entity.refresh();
    await sendMessage({ type: HASSIO_WS_COMMAND.subscribe_events }, false);
  }

  /**
   * Called on incoming message.
   * Intended to interpret the basic concept of the message,
   * and route it to the correct callback / global channel / etc
   *
   * ## auth_required
   * Hello message from server, should reply back with an auth msg
   * ## auth_ok
   * Follow up with a request to receive all events, and request a current state listing
   * ## event
   * Something updated it's state
   * ## pong
   * Reply to outgoing ping()
   * ## result
   * Response to an outgoing emit
   */
  async function onMessage(message: SocketMessageDTO) {
    const id = Number(message.id);
    ZCC.event.emit(HASS_WEBSOCKET_RECEIVE_MESSAGE, {
      type: message.type,
    } as HassWebsocketReceiveMessageData);
    switch (message.type as HassSocketMessageTypes) {
      case HassSocketMessageTypes.auth_required:
        logger.debug(`Sending authentication`);
        return await sendAuth();

      case HassSocketMessageTypes.auth_ok:
        logger.debug(`[CONNECTION_ACTIVE] = {true}`);
        // * Flag as valid connection
        CONNECTION_ACTIVE = true;
        clearTimeout(AUTH_TIMEOUT);
        await subscribeEvents();
        ZCC.event.emit(ON_SOCKET_AUTH);
        return;

      case HassSocketMessageTypes.event:
        return await onMessageEvent(id, message);

      case HassSocketMessageTypes.pong:
        // 🏓
        if (waitingCallback.has(id)) {
          const f = waitingCallback.get(id);
          waitingCallback.delete(id);
          f(message);
        }
        return;

      case HassSocketMessageTypes.result:
        return await onMessageResult(id, message);

      case HassSocketMessageTypes.auth_invalid:
        logger.debug(`[CONNECTION_ACTIVE] = {false}`);
        CONNECTION_ACTIVE = false;
        logger.fatal(message.message);
        return;

      default:
        // Code error probably
        logger.error(`Unknown websocket message type: ${message.type}`);
    }
  }

  function onMessageEvent(id: number, message: SocketMessageDTO) {
    eventManager.onMessage(message);
    if (waitingCallback.has(id)) {
      const f = waitingCallback.get(id);
      waitingCallback.delete(id);
      f(message.event.result);
    }
    if (subscriptionCallbacks.has(id)) {
      const f = subscriptionCallbacks.get(id);
      f(message.event.result);
    }
  }

  function onMessageResult(id: number, message: SocketMessageDTO) {
    if (waitingCallback.has(id)) {
      if (message.error) {
        logger.error({ message });
      }

      const f = waitingCallback.get(id);
      waitingCallback.delete(id);
      f(message.result);
    }
  }

  async function sendAuth(): Promise<void> {
    AUTH_TIMEOUT = setTimeout(() => {
      logger.error(`Did not receive an auth response, retrying`);
      sendAuth();
    }, retryInterval);
    await sendMessage({
      access_token: token,
      type: HASSIO_WS_COMMAND.auth,
    });
  }

  return {
    getConnectionActive: () => CONNECTION_ACTIVE,
    sendMessage,
    teardown,
  };
}
