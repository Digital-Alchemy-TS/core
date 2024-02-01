import "@zcc/automation-logic";

import { LIB_AUTOMATION_LOGIC } from "@zcc/automation-logic";
import { CreateApplication } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/home-assistant";
import { LIB_SERVER } from "@zcc/server";
import { LIB_VIRTUAL_ENTITY } from "@zcc/virtual-entity";

import {
  LutronPicoBindings,
  MockExtension,
  SensorsExtension,
} from "./extensions/index.mjs";
import { AllRooms } from "./rooms/all.room.mjs";
import { BedRoom, LivingRoom, Office } from "./rooms/index.mjs";

export const AUTOMATION_EXAMPLE_APP = CreateApplication({
  libraries: [
    LIB_SERVER,
    LIB_HOME_ASSISTANT,
    LIB_VIRTUAL_ENTITY,
    LIB_AUTOMATION_LOGIC,
  ],
  name: "automation-example",
  priorityInit: ["sensors", "mock"],
  services: {
    bed: BedRoom,
    global: AllRooms,
    living: LivingRoom,
    mock: MockExtension,
    office: Office,
    pico: LutronPicoBindings,
    sensors: SensorsExtension,
  },
});
