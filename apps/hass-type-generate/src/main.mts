import "@zcc/home-assistant";

import { CreateApplication } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/home-assistant";

import { BuildTypes } from "./build.extension.mjs";
import { TypeWriter } from "./type-writer.extension.mjs";

export const HASS_TYPE_GENERATE = CreateApplication({
  configuration: {
    TARGET_FILE: {
      description:
        "Define a file to write types to. Autodetect = default behavior",
      type: "string",
    },
  },
  libraries: [LIB_HOME_ASSISTANT],
  name: "hass-type-generate",
  services: {
    build: BuildTypes,
    typeWriter: TypeWriter,
  },
});
