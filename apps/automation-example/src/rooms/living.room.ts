import { LIB_AUTOMATION_LOGIC } from "@zcc/automation-logic";
import { TServiceParams } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/home-assistant";
import { CronExpression, ZCC } from "@zcc/utilities";

import { AUTOMATION_EXAMPLE_APP } from "../main";

export function LivingRoom({ getApis, context, scheduler }: TServiceParams) {
  //
  // imports & definitions
  //
  const app = getApis(AUTOMATION_EXAMPLE_APP);
  const automation = getApis(LIB_AUTOMATION_LOGIC);
  const hass = getApis(LIB_HOME_ASSISTANT);

  //
  // scheduler
  //
  automation.solar.onEvent({
    context,
    eventName: "sunriseEnd",
    exec: async () => {
      if (room.scene === "evening_high") {
        room.scene = "high";
      }
    },
  });

  automation.solar.onEvent({
    context,
    eventName: "sunsetStart",
    exec: async () => {
      if (room.scene === "high") {
        room.scene = "evening_high";
      }
    },
  });

  scheduler.cron({
    context,
    exec: async () => {
      if (room.scene === "auto") {
        room.scene = "evening";
      }
    },
    schedule: CronExpression.EVERY_DAY_AT_11PM,
  });

  //
  // the room
  //

  const room = automation.room({
    context,
    id: "living_room",
    name: "Living Room",
    scenes: {
      auto: {
        definition: {
          "light.living_room_fan": { brightness: 100, state: "on" },
          "light.tower_left": { brightness: 200, state: "on" },
          "light.tower_right": { brightness: 200, state: "on" },
          "switch.living_room_accessories": { state: "on" },
        },
        friendly_name: "Auto",
      },
      dimmed: {
        definition: {
          "light.living_room_fan": { brightness: 100, state: "on" },
          "light.tower_left": { brightness: 200, state: "on" },
          "light.tower_right": { brightness: 200, state: "on" },
          "switch.living_room_accessories": { state: "on" },
        },
        friendly_name: "Dimmed",
      },
      evening: {
        definition: {
          "light.living_room_fan": { brightness: 80, state: "on" },
          "light.tower_left": { brightness: 100, state: "on" },
          "light.tower_right": { brightness: 100, state: "on" },
          "switch.living_room_accessories": { state: "off" },
        },
        friendly_name: "Evening",
      },
      evening_high: {
        definition: {
          "light.living_room_fan": { brightness: 200, state: "on" },
          "light.tower_left": { brightness: 200, state: "on" },
          "light.tower_right": { brightness: 200, state: "on" },
          "switch.living_room_accessories": { state: "on" },
        },
        friendly_name: "Evening High",
      },
      high: {
        definition: {
          "light.living_room_fan": { brightness: 255, state: "on" },
          "light.tower_left": { brightness: 255, state: "on" },
          "light.tower_right": { brightness: 255, state: "on" },
          "switch.living_room_accessories": { state: "on" },
        },
        friendly_name: "High",
      },
      off: {
        definition: {
          "light.living_room_fan": { state: "off" },
          "light.tower_left": { state: "off" },
          "light.tower_right": { state: "off" },
          "switch.living_room_accessories": { state: "off" },
        },
        friendly_name: "Off",
      },
    },
  });

  //
  // entities
  //
  const { guestMode, isHome, meetingMode } = app.sensors;

  //
  // managed switches
  //
  automation.managedSwitch({
    context,
    entity_id: "switch.media_backdrop",
    onEntityUpdate: [meetingMode, isHome],
    shouldBeOn() {
      if (isHome.state === "off") {
        return false;
      }
      if (automation.solar.isBetween("sunriseEnd", "sunriseEnd")) {
        return false;
      }
      const [PM8, NOW] = ZCC.shortTime(["PM08", "NOW"]);
      return NOW.isAfter(PM8) && !room.scene.includes("high");
    },
  });

  automation.managedSwitch({
    context,
    entity_id: "switch.moon_mirror",
    onEntityUpdate: [guestMode],
    shouldBeOn() {
      const [PM5, AM5, NOW] = ZCC.shortTime(["PM5", "AM5", "NOW"]);
      if (!NOW.isBetween(AM5, PM5)) {
        return true;
      }
      return guestMode.on;
    },
  });

  //
  // pico bindings: wall
  //
  app.pico.living({
    context,
    exec: async () => (room.scene = "auto"),
    match: ["stop", "stop"],
  });

  app.pico.living({
    context,
    exec: async () =>
      await hass.call.scene.turn_on({
        entity_id: ["scene.office_off", "scene.bed_off"],
      }),
    match: ["stop", "stop", "stop"],
  });

  app.pico.living({
    context,
    exec: () =>
      (room.scene = automation.solar.isBetween("sunriseEnd", "sunsetStart")
        ? "high"
        : "evening_high"),
    match: ["on"],
  });

  app.pico.living({
    context,
    exec: async () => (room.scene = "off"),
    match: ["off"],
  });

  return room;
}
