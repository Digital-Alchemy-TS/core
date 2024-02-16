import { CreateLibrary } from "..";
import {
  CallProxy,
  EntityManager,
  FetchAPI,
  Utilities,
  WebsocketAPI,
} from "./extensions";

export const LIB_HASS = CreateLibrary({
  configuration: {
    BASE_URL: {
      default: "http://localhost:8123",
      description: "Url to reach Home Assistant at",
      type: "string",
    },
    CALL_PROXY_AUTO_SCAN: {
      default: true,
      description:
        "Should the call proxy request a service listing at bootstrap?",
      type: "boolean",
    },
    CRASH_REQUESTS_PER_SEC: {
      default: 500,
      description:
        "Socket service will commit sudoku if more than this many outgoing messages are sent to Home Assistant in a second. Usually indicates runaway code.",
      type: "number",
    },
    RENDER_TIMEOUT: {
      default: 3,
      description:
        "Max time to wait for template rendering via Home Assistant. This value is used by HA, not the controller.",
      type: "number",
    },
    RETRY_INTERVAL: {
      default: 5000,
      description: "How often to retry connecting on connection failure (ms).",
      type: "number",
    },
    SOCKET_AUTO_CONNECT: {
      default: true,
      description: "Websocket must be manually initialized if set to false",
      type: "boolean",
    },
    TALK_BACK_BASE_URL: {
      default: "http://192.168.1.1:7000",
      description: "Base url to use with callbacks in home assistant",
      type: "string",
    },
    TOKEN: {
      // Not absolutely required, if the app does not intend to open a connection
      // Should probably use the other module though
      description: "Long lived access token to Home Assistant.",
      type: "string",
    },
    VERIFICATION_FILE: {
      default: "zcc_configuration",
      description:
        "Target file for storing app configurations within the package folder.",
      type: "string",
    },
    WARN_REQUESTS_PER_SEC: {
      default: 300,
      description:
        "Emit warnings if the home controller attempts to send more than X messages to Home Assistant inside of a second.",
      type: "number",
    },
    WEBSOCKET_URL: {
      description: `Override calculated value if it's breaking or you want something custom. Make sure to use "ws[s]://" scheme.`,
      type: "string",
    },
  },
  name: "hass",
  // no internal dependency ones first
  priorityInit: ["fetch", "utils"],
  services: {
    call: CallProxy,
    entity: EntityManager,
    fetch: FetchAPI,
    socket: WebsocketAPI,
    utils: Utilities,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    hass: typeof LIB_HASS;
  }
}
