import { InternalError, TServiceParams } from "@zcc/boilerplate";
import { SECOND, sleep, START } from "@zcc/utilities";
import { exit } from "process";
import WS from "ws";

import {
  HASS_WEBSOCKET_RECEIVE_MESSAGE,
  HASS_WEBSOCKET_SEND_MESSAGE,
  HASSIO_WS_COMMAND,
  HassSocketMessageTypes,
  HassWebsocketReceiveMessageData,
  HassWebsocketSendMessageData,
  ON_SOCKET_AUTH,
  SOCKET_MESSAGES,
  SocketMessageDTO,
} from "../helpers/index.mjs";
import { LIB_HOME_ASSISTANT } from "../home-assistant.module.mjs";

let connection: WS;
const CONNECTION_OPEN = 1;
let CONNECTION_ACTIVE = false;
const CLEANUP_INTERVAL = 5;
const PING_INTERVAL = 10;
let messageCount = START;

export function WebsocketAPIService({
  logger,
  lifecycle,
  scheduler,
  context,
  event,
}: TServiceParams) {
  let token: string;
  let WARN_REQUESTS: number;
  let CRASH_REQUESTS: number;
  let AUTH_TIMEOUT: ReturnType<typeof setTimeout>;
  let baseUrl: string;
  let websocketUrl: string;
  let retryInterval: number;
  let autoConnect = false;

  let MESSAGE_TIMESTAMPS: number[] = [];
  const waitingCallback = new Map<number, (result) => void>();

  // Load configurations
  lifecycle.onPostConfig(() => {
    autoConnect = LIB_HOME_ASSISTANT.getConfig("SOCKET_AUTO_CONNECT");
    token = LIB_HOME_ASSISTANT.getConfig("TOKEN");
    baseUrl = LIB_HOME_ASSISTANT.getConfig("BASE_URL");
    websocketUrl = LIB_HOME_ASSISTANT.getConfig("WEBSOCKET_URL");
    WARN_REQUESTS = LIB_HOME_ASSISTANT.getConfig("WARN_REQUESTS_PER_SEC");
    CRASH_REQUESTS = LIB_HOME_ASSISTANT.getConfig("CRASH_REQUESTS_PER_SEC");
    retryInterval = LIB_HOME_ASSISTANT.getConfig("RETRY_INTERVAL");
    logger.trace(
      { CRASH_REQUESTS, WARN_REQUESTS, autoConnect, retryInterval },
      `Load configuration`,
    );
  });

  // Start the socket
  lifecycle.onBootstrap(async () => {
    if (autoConnect) {
      logger.debug(`Auto starting connection`);
      await init();
    }
  });

  // Set up intervals
  scheduler({
    context,
    exec: async () => await ping(),
    interval: PING_INTERVAL * SECOND,
  });
  scheduler({
    context,
    exec: () => {
      const now = Date.now();
      MESSAGE_TIMESTAMPS = MESSAGE_TIMESTAMPS.filter(
        time => time > now - SECOND,
      );
    },
    interval: CLEANUP_INTERVAL * SECOND,
  });

  lifecycle.onShutdownStart(async () => {
    logger.debug(`[Shutdown] Tearing down connection`);
    await teardown();
  });

  async function ping() {
    if (!CONNECTION_ACTIVE) {
      return;
    }
    try {
      logger.trace(`ping`);
      const pong = await sendMessage({ type: HASSIO_WS_COMMAND.ping });
      if (pong) {
        return;
      }
      // Tends to happen when HA resets
      // Resolution is to re-connect when it's up again
      logger.error(`Failed to pong!`);
    } catch (error) {
      logger.error({ error }, `ping error`);
    }
    logger.debug(`[ping] teardown`);
    await teardown();
    logger.debug(`[ping] re-init`);
    await init();
  }

  async function teardown() {
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
    event.emit(HASS_WEBSOCKET_SEND_MESSAGE, {
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
    event.emit(HASS_WEBSOCKET_RECEIVE_MESSAGE, {
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
        event.emit(ON_SOCKET_AUTH);
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
    if (waitingCallback.has(id)) {
      const f = waitingCallback.get(id);
      waitingCallback.delete(id);
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
    init,
    sendAuth,
    sendMessage,
    teardown,
  };
}
