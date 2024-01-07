import { ZCC } from "@zcc/utilities";

import {
  BASE_URL,
  CRASH_REQUESTS_PER_SEC,
  HOME_ASSISTANT_PACKAGE_FOLDER,
  RENDER_TIMEOUT,
  RETRY_INTERVAL,
  TALK_BACK_BASE_URL,
  TOKEN,
  VERIFICATION_FILE,
  WARN_REQUESTS_PER_SEC,
  WEBSOCKET_URL,
} from "./helpers/config.constants.mjs";

export const LIB_HOME_ASSISTANT = ZCC.createLibrary({
  configuration: {
    [BASE_URL]: {
      default: "http://localhost:8123",
      description: "Url to reach Home Assistant at",
      type: "string",
    },
    [CRASH_REQUESTS_PER_SEC]: {
      default: 500,
      description:
        "Socket service will commit sudoku if more than this many outgoing messages are sent to Home Assistant in a second. Usually indicates runaway code.",
      type: "number",
    },
    [HOME_ASSISTANT_PACKAGE_FOLDER]: {
      // ? Dev note: if running multiple apps from a single repository (like this repo does), this value should be shared
      // values are actually nested 1 folder deeper: packages/{APPLICATION_IDENTIFIER}/...
      default: "/path/to/homeassistant/packages/",
      description: [
        "Packages folder to write push entity info to, this will need to be manually included to make operational",
        "Value only used with push entity configurations, incorrect values will not affect normal websocket operation",
      ].join(`. `),
      type: "string",
    },
    [RENDER_TIMEOUT]: {
      default: 3,
      description:
        "Max time to wait for template rendering via Home Assistant. This value is used by HA, not the controller.",
      type: "number",
    },
    [RETRY_INTERVAL]: {
      default: 5000,
      description: "How often to retry connecting on connection failure (ms).",
      type: "number",
    },
    [TALK_BACK_BASE_URL]: {
      default: "http://192.168.1.1:7000",
      description: "Base url to use with callbacks in home assistant",
      type: "string",
    },
    [TOKEN]: {
      // Not absolutely required, if the app does not intend to open a connection
      // Should probably use the other module though
      description: "Long lived access token to Home Assistant.",
      type: "string",
    },
    [VERIFICATION_FILE]: {
      default: "digital_alchemy_configuration",
      description:
        "Target file for storing app configurations within the package folder.",
      type: "string",
    },
    [WARN_REQUESTS_PER_SEC]: {
      default: 300,
      description:
        "Emit warnings if the home controller attempts to send more than X messages to Home Assistant inside of a second.",
      type: "number",
    },
    [WEBSOCKET_URL]: {
      description: `Override calculated value if it's breaking or you want something custom. Make sure to use "ws[s]://" scheme.`,
      type: "string",
    },
  },
  library: "home-assistant",
});
