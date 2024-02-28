import { CreateLibrary } from "..";
import {
  CallProxy,
  EntityManager,
  FetchAPI,
  Utilities,
  Validate,
  WebsocketAPI,
} from "./extensions";

export const LIB_HASS = CreateLibrary({
  configuration: {
    AUTO_CONNECT_SOCKET: {
      default: true,
      description: "Websocket must be manually initialized if set to false",
      type: "boolean",
    },
    AUTO_SCAN_CALL_PROXY: {
      default: true,
      description:
        "Should the call proxy request a service listing at bootstrap?",
      type: "boolean",
    },
    BASE_URL: {
      default: "http://localhost:8123",
      description: "Url to reach Home Assistant at",
      type: "string",
    },
    RETRY_INTERVAL: {
      default: 5000,
      description: "How often to retry connecting on connection failure (ms).",
      type: "number",
    },
    SOCKET_CRASH_REQUESTS_PER_SEC: {
      default: 500,
      description:
        "Socket service will commit sudoku if more than this many outgoing messages are sent to Home Assistant in a second. Usually indicates runaway code.",
      type: "number",
    },
    SOCKET_WARN_REQUESTS_PER_SEC: {
      default: 300,
      description:
        "Emit warnings if the home controller attempts to send more than X messages to Home Assistant inside of a second.",
      type: "number",
    },
    TOKEN: {
      description: "Long lived access token to Home Assistant.",
      required: true,
      type: "string",
    },
    VALIDATE_CONFIGURATION: {
      default: false,
      description: "Validate the credentials, then quit",
      type: "boolean",
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
    /**
     * general service calling interface
     */
    call: CallProxy,
    /**
     * retrieve and interact with home assistant entities
     */
    entity: EntityManager,
    /**
     * rest api commands
     */
    fetch: FetchAPI,
    /**
     * websocket interface
     */
    socket: WebsocketAPI,
    /**
     * extra helper functions for interacting with home assistant
     */
    utils: Utilities,
    /**
     * internal tool
     */
    validate: Validate,
  },
});

declare module "../boilerplate" {
  export interface LoadedModules {
    /**
     * tools for interacting with home assistant
     */
    hass: typeof LIB_HASS;
  }
}
