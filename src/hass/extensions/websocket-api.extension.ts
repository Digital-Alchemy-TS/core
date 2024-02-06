import { EventEmitter } from "node-cache";
import { exit } from "process";
import WS from "ws";

import { InternalError, TServiceParams } from "../../boilerplate";
import { SECOND, sleep, START, TBlackHole, ZCC } from "../../utilities";
import {
  HassEventDTO,
  HASSIO_WS_COMMAND,
  HassSocketMessageTypes,
  ON_SOCKET_AUTH,
  OnHassEventOptions,
  SOCKET_EVENT_ERRORS,
  SOCKET_EVENT_EXECUTION_COUNT,
  SOCKET_EVENT_EXECUTION_TIME,
  SOCKET_MESSAGES,
  SocketMessageDTO,
} from "..";

let connection: WS;
const CONNECTION_OPEN = 1;
let CONNECTION_ACTIVE = false;
const CLEANUP_INTERVAL = 5;
const PING_INTERVAL = 10;
let messageCount = START;

export function WebsocketAPI({
  context,
  event,
  hass,
  config,
  lifecycle,
  logger,
  scheduler,
}: TServiceParams) {
  let AUTH_TIMEOUT: ReturnType<typeof setTimeout>;

  /**
   * Local attachment points for socket events
   */
  const socketEvents = new EventEmitter();

  let MESSAGE_TIMESTAMPS: number[] = [];
  const waitingCallback = new Map<number, (result: unknown) => TBlackHole>();

  // Start the socket
  lifecycle.onBootstrap(async () => {
    if (config.hass.SOCKET_AUTO_CONNECT) {
      logger.debug(`Auto starting connection`);
      await init();
    }
  });

  // Set up intervals
  scheduler.interval({
    context,
    exec: async () => await ping(),
    interval: PING_INTERVAL * SECOND,
  });
  scheduler.interval({
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
    logger.debug(`shutdown - tearing down connection`);
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
    logger.debug(`ping teardown`);
    await teardown();
    logger.debug(`ping re-init`);
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
      waitingCallback.set(
        messageCount,
        done as (result: unknown) => TBlackHole,
      ),
    );
  }

  function countMessage(): void | never {
    messageCount++;
    const now = Date.now();
    MESSAGE_TIMESTAMPS.push(now);
    const count = MESSAGE_TIMESTAMPS.filter(time => time > now - SECOND).length;
    if (count > config.hass.CRASH_REQUESTS_PER_SEC) {
      logger.fatal(`FATAL ERROR: Exceeded {CRASH_REQUESTS_PER_MIN} threshold.`);
      exit();
    }
    if (count > config.hass.WARN_REQUESTS_PER_SEC) {
      logger.warn(
        `Message traffic ${config.hass.CRASH_REQUESTS_PER_SEC}>${count}>${config.hass.WARN_REQUESTS_PER_SEC}`,
      );
    }
  }

  function getUrl() {
    const url = new URL(config.hass.BASE_URL);
    const protocol = url.protocol === `http:` ? `ws:` : `wss:`;
    return (
      config.hass.WEBSOCKET_URL ||
      `${protocol}//${url.hostname}${
        url.port ? `:${url.port}` : ``
      }/api/websocket`
    );
  }

  async function init(): Promise<void> {
    if (connection) {
      throw new InternalError(
        context,
        "ExistingConnection",
        `Destroy the current connection before creating a new one`,
      );
    }
    logger.debug(`CONNECTION_ACTIVE = false`);
    const url = getUrl();
    CONNECTION_ACTIVE = false;
    try {
      messageCount = START;
      connection = new WS(url);
      connection.on("message", async message => {
        try {
          await onMessage(JSON.parse(message.toString()));
        } catch (error) {
          // My expectation is `ZCC.safeExec` should trap any application errors
          // This try/catch should actually be excessive
          // If this error happens, something weird is happening
          logger.error(
            { error },
            `Error bubbled up from websocket message event handler. This should not happen`,
          );
        }
      });
      connection.on("error", async error => {
        logger.error({ error: error.message || error }, "Socket error");
        if (!CONNECTION_ACTIVE) {
          await sleep(config.hass.RETRY_INTERVAL);
          await teardown();
          await init();
        }
      });
      return await new Promise(done => {
        connection.once("open", () => done());
      });
    } catch (error) {
      logger.error({ error, url }, `initConnection error`);
    }
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
    switch (message.type as HassSocketMessageTypes) {
      case HassSocketMessageTypes.auth_required:
        logger.debug(`Sending authentication`);
        return await sendAuth();

      case HassSocketMessageTypes.auth_ok:
        logger.debug(`CONNECTION_ACTIVE = {true}`);
        // * Flag as valid connection
        CONNECTION_ACTIVE = true;
        clearTimeout(AUTH_TIMEOUT);
        logger.debug(`Event Subscriptions starting`);
        await sendMessage({ type: HASSIO_WS_COMMAND.subscribe_events }, false);
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
        logger.debug(`CONNECTION_ACTIVE = {false}`);
        CONNECTION_ACTIVE = false;
        logger.fatal(message.message);
        return;

      default:
        // Code error probably
        logger.error(`Unknown websocket message type: ${message.type}`);
    }
  }

  function onMessageEvent(id: number, message: SocketMessageDTO) {
    if (message.event.event_type === "state_changed") {
      const { new_state, old_state } = message.event.data;
      if (new_state) {
        hass.entity[Symbol.for("entityUpdateReceiver")](
          new_state.entity_id,
          new_state,
          old_state,
        );
      } else {
        // FIXME: probably removal / rename?
        // It's an edge case for sure, and not positive this code should handle it
        // If you have thoughts, chime in somewhere and we can do more sane things
        logger.debug(`No new state for entity, what caused this?`);
        return;
      }
    }
    if (waitingCallback.has(id)) {
      const f = waitingCallback.get(id);
      waitingCallback.delete(id);
      f(message.event.result);
    }

    socketEvents.emit(message.event.event_type, message.event);
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
    }, config.hass.RETRY_INTERVAL);
    await sendMessage({
      access_token: config.hass.TOKEN,
      type: HASSIO_WS_COMMAND.auth,
    });
  }

  function onEvent({ context, label, event, exec }: OnHassEventOptions) {
    logger.debug({ context, event }, `Attaching socket event listener`);
    const callback = async (data: HassEventDTO) => {
      await ZCC.safeExec({
        duration: SOCKET_EVENT_EXECUTION_TIME,
        errors: SOCKET_EVENT_ERRORS,
        exec: async () => await exec(data),
        executions: SOCKET_EVENT_EXECUTION_COUNT,
        labels: { context, event, label },
      });
    };
    socketEvents.on(event, callback);
    return () => {
      logger.debug({ context, event }, `Removing socket event listener`);
      socketEvents.removeListener(event, callback);
    };
  }

  return {
    getConnectionActive: () => CONNECTION_ACTIVE,
    /**
     * Set up a new websocket connection to home assistant
     *
     * This doesn't normally need to be called by applications, the extension self manages
     */
    init,
    /**
     * Attach to the incoming stream of socket events. Do your own filtering and processing from there
     *
     * Returns removal function
     */
    onEvent,
    /**
     * Send a message to home assistant via the socket connection
     *
     * Applications probably want a higher level function than this
     */
    sendMessage,
    /**
     * remove the current socket connection to home assistant
     *
     * will need to call init() again to start up
     */
    teardown,
  };
}