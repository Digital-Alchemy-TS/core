import { ZCC } from "@zcc/utilities";

import {
  GotifyApplication,
  GotifyClient,
  GotifyFetch,
  GotifyMessage,
} from "./extensions/index.mjs";

export const LIB_GOTIFY = ZCC.createLibrary({
  configuration: {
    BASE_URL: {
      description: "Base URL for server",
      required: true,
      type: "string",
    },
    CHANNEL_MAPPING: {
      default: {},
      description:
        "Mapping of application names to tokens. Keep your keys out of the code!",
      type: "record",
    },
    TOKEN: {
      description: "Application token",
      required: true,
      type: "string",
    },
  },
  name: "gotify",
  services: {
    application: GotifyApplication,
    client: GotifyClient,
    fetch: GotifyFetch,
    message: GotifyMessage,
  },
});
