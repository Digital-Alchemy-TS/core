import { ZCC } from "@zcc/utilities";

import { BASE_URL, CHANNEL_MAPPING, TOKEN } from "./helpers/index.mjs";

export const LIB_GOTIFY = ZCC.createLibrary({
  configuration: {
    [BASE_URL]: {
      description: "Base URL for server",
      required: true,
      type: "string",
    },
    [CHANNEL_MAPPING]: {
      default: {},
      description:
        "Mapping of application names to tokens. Keep your keys out of the code!",
      type: "record",
    },
    [TOKEN]: {
      description: "Application token",
      required: true,
      type: "string",
    },
  },
  library: "gotify",
});
