import "@zcc/automation-logic";

import { LIB_AUTOMATION_LOGIC } from "@zcc/automation-logic";
import { CreateApplication } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/hass";
import { LIB_SERVER } from "@zcc/server";
import { LIB_VIRTUAL_ENTITY } from "@zcc/virtual-entity";

import {
  LutronPicoBindings,
  MockExtension,
  SensorsExtension,
} from "./extensions";
import { BedRoom, LivingRoom, Office } from "./rooms";
import { AllRooms } from "./rooms/all.room";

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
