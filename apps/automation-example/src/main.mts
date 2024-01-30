import "@zcc/automation-logic";
import "@zcc/boilerplate";
import "@zcc/home-assistant";
import "@zcc/server";
import "@zcc/virtual-entity";

import { LIB_AUTOMATION_LOGIC } from "@zcc/automation-logic";
import { CreateApplication } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/home-assistant";
import { LIB_SERVER } from "@zcc/server";
import { LIB_VIRTUAL_ENTITY } from "@zcc/virtual-entity";

import { LutronPicoBindings, MockExtension } from "./extensions/index.mjs";
import { Office } from "./rooms/index.mjs";

export const AUTOMATION_EXAMPLE_APP = CreateApplication({
  libraries: [
    LIB_SERVER,
    LIB_HOME_ASSISTANT,
    LIB_VIRTUAL_ENTITY,
    LIB_AUTOMATION_LOGIC,
  ],
  name: "automation-example",
  services: {
    mock: MockExtension,
    office: Office,
    pico: LutronPicoBindings,
  },
});
