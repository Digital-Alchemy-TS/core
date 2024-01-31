import { LIB_AUTOMATION_LOGIC } from "@zcc/automation-logic";
import { TServiceParams } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT, PICK_ENTITY } from "@zcc/home-assistant";
import { ZCC } from "@zcc/utilities";
import { LIB_VIRTUAL_ENTITY } from "@zcc/virtual-entity";
import dayjs from "dayjs";

import { AUTOMATION_EXAMPLE_APP } from "../main.mjs";

export function Office({
  getApis,
  context,
  logger,
  scheduler,
}: TServiceParams) {
  //
  // imports & definitions
  //
  const app = getApis(AUTOMATION_EXAMPLE_APP);
  const automation = getApis(LIB_AUTOMATION_LOGIC);
  const hass = getApis(LIB_HOME_ASSISTANT);
  const virtual = getApis(LIB_VIRTUAL_ENTITY);

  //
  // General use functions
  //

  function AutoScene(): PICK_ENTITY<"scene"> {
    const [PM10, AM6, PM1030] = ZCC.refTime(["22:00", "06", "22:30"]);
    const now = dayjs();
    if (now.isBetween(AM6, PM10)) {
      return "scene.office_auto";
    }
    return (now.isBefore(PM1030) && now.isAfter(AM6)) ||
      room.getScene() === "night"
      ? "scene.office_dim"
      : "scene.office_night";
  }

  async function Focus() {
    logger.info(`Focus office`);
    await hass.call.scene.turn_on({
      entity_id: ["scene.bedroom_off", "scene.living_off", AutoScene()],
    });
  }

  //
  // scheduler
  //
  scheduler.cron({
    context,
    exec: async () => {
      if (!["auto", "dim"].includes(room.getScene())) {
        return;
      }
      // go to bed, seriously
      await hass.call.scene.turn_on({
        entity_id: "scene.office_evening",
      });
    },
    schedule: "30 22 * * *",
  });

  //
  // the room
  //

  const room = automation.room({
    context,
    id: "office",
    name: "Office",
    scenes: {
      auto: {
        definition: {
          "light.monitor_bloom": { brightness: 255, state: "on" },
          "light.office_fan": { brightness: 150, state: "on" },
          "light.office_plant_accent": { brightness: 200, state: "on" },
          "switch.desk_strip_dog_light": { state: "on" },
          "switch.mega_matrix": { state: "on" },
        },
        friendly_name: "Auto",
      },
      dim: {
        definition: {
          "light.monitor_bloom": { brightness: 150, state: "on" },
          "light.office_fan": { brightness: 100, state: "on" },
          "light.office_plant_accent": { brightness: 150, state: "on" },
          "switch.desk_strip_dog_light": { state: "off" },
          "switch.mega_matrix": { state: "on" },
        },
        friendly_name: "Dim",
      },
      evening: {
        definition: {
          "light.monitor_bloom": { brightness: 150, state: "on" },
          "light.office_fan": { brightness: 50, state: "on" },
          "light.office_plant_accent": { brightness: 150, state: "on" },
          "switch.desk_strip_dog_light": { state: "off" },
          "switch.mega_matrix": { state: "on" },
        },
        friendly_name: "Evening",
      },
      high: {
        definition: {
          "light.monitor_bloom": { brightness: 255, state: "on" },
          "light.office_fan": { brightness: 255, state: "on" },
          "light.office_plant_accent": { brightness: 255, state: "on" },
          "switch.desk_strip_dog_light": { state: "on" },
          "switch.mega_matrix": { state: "on" },
        },
        friendly_name: "High",
      },
      meeting: {
        definition: {
          "light.monitor_bloom": { brightness: 255, state: "on" },
          "light.office_fan": { brightness: 100, state: "on" },
          "light.office_plant_accent": { brightness: 100, state: "on" },
          "switch.desk_strip_crafts": { state: "off" },
          "switch.desk_strip_dog_light": { state: "off" },
          "switch.mega_matrix": { state: "on" },
        },
        friendly_name: "Meeting",
      },
      night: {
        definition: {
          "light.monitor_bloom": { brightness: 75, state: "on" },
          "light.office_fan": { brightness: 40, state: "on" },
          "light.office_plant_accent": { brightness: 80, state: "on" },
          "switch.desk_strip_dog_light": { state: "off" },
          "switch.mega_matrix": { state: "on" },
        },
        friendly_name: "Night",
      },
      off: {
        definition: {
          "light.monitor_bloom": { state: "off" },
          "light.office_fan": { state: "off" },
          "light.office_plant_accent": { state: "off" },
          "switch.desk_strip_crafts": { state: "off" },
          "switch.desk_strip_dog_light": { state: "off" },
          "switch.mega_matrix": { state: "off" },
        },
        friendly_name: "Off",
      },
    },
  });

  //
  // entities
  //
  // official
  const isHome = hass.entity.byId("binary_sensor.is_home");
  const doorbell = hass.entity.byId("binary_sensor.doorbell_doorbell");
  const { meetingMode } = app.sensors;

  // virtual

  virtual.button({
    context,
    exec: async () => await Focus(),
    id: "office_focus",
    name: "Office Focus",
  });

  //
  // managed switches
  //

  // Blanket light
  automation.managedSwitch({
    context,
    entity_id: "switch.blanket_light",
    onEntityUpdate: ["switch.meeting_mode", "binary_sensor.is_home"],
    shouldBeOn() {
      if (isHome.state === "off") {
        return false;
      }
      if (meetingMode.on) {
        return true;
      }
      const [AM7, PM7, NOW] = ZCC.shortTime(["AM7", "PM7", "NOW"]);
      return !NOW.isBetween(AM7, PM7);
    },
  });

  // Fairy lights
  automation.managedSwitch({
    context,
    entity_id: "switch.fairy_lights",
    onEntityUpdate: ["switch.meeting_mode", "binary_sensor.is_home"],
    shouldBeOn() {
      if (isHome.state === "off") {
        return false;
      }
      const [AM7, PM10, NOW] = ZCC.shortTime(["AM7", "PM10", "NOW"]);
      return NOW.isBetween(AM7, PM10);
    },
  });

  // Plant lights
  automation.managedSwitch({
    context,
    entity_id: "switch.desk_strip_office_plants",
    onEntityUpdate: ["switch.meeting_mode"],
    shouldBeOn() {
      if (meetingMode.on) {
        return false;
      }
      if (!automation.solar.isBetween("sunrise", "sunset")) {
        return false;
      }
      const [PM3, PM5, NOW] = ZCC.shortTime(["PM3", "PM5", "NOW"]);
      if (NOW.isBefore(PM3)) {
        return true;
      }
      if (NOW.isAfter(PM5)) {
        return false;
      }
      if (room.getScene() !== "high") {
        return false;
      }
      // leave as is
      return undefined;
    },
  });

  // Wax warmer
  automation.managedSwitch({
    context,
    entity_id: "switch.desk_strip_wax",
    onEntityUpdate: [
      "switch.windows_open",
      "sensor.office_current_scene",
      "sensor.office_current_scene",
    ],
    shouldBeOn() {
      const scene = room.getScene();
      const [PM9, AM5, NOW] = ZCC.shortTime(["PM9", "AM5", "NOW"]);
      return (scene !== "off" && NOW.isBetween(AM5, PM9)) || scene === "auto";
    },
  });

  //
  // pico bindings: wall
  //
  app.pico.office({
    context,
    exec: async () => await room.setScene("high"),
    match: ["on"],
  });

  app.pico.office({
    context,
    exec: async () =>
      await hass.call.scene.turn_on({
        entity_id: AutoScene(),
      }),
    match: ["stop", "stop"],
  });

  app.pico.office({
    context,
    exec: async () => await room.setScene("off"),
    match: ["off"],
  });

  //
  // pico bindings: desk
  //
  app.pico.desk({
    context,
    exec: async () =>
      await hass.call.fan.decrease_speed({
        entity_id: "fan.office_ceiling_fan",
      }),
    match: ["lower"],
  });

  app.pico.desk({
    context,
    exec: async () =>
      await hass.call.fan.turn_off({
        entity_id: "fan.office_ceiling_fan",
      }),
    match: ["lower", "lower"],
  });

  app.pico.desk({
    context,
    exec: async () =>
      await hass.call.fan.increase_speed({
        entity_id: "fan.office_ceiling_fan",
      }),
    match: ["raise"],
  });

  app.pico.desk({
    context,
    exec: async () => await Focus(),
    match: ["stop", "stop"],
  });

  app.pico.desk({
    context,
    exec: async () => await room.setScene("high"),
    match: ["on"],
  });

  app.pico.desk({
    context,
    exec: async () => await room.setScene("off"),
    match: ["off"],
  });

  app.pico.desk({
    context,
    exec: async () => await app.mock.findPhone(),
    match: ["stop", "lower", "raise"],
  });

  hass.entity.OnUpdate("binary_sensor.doorbell_doorbell", async () => {
    if (doorbell.state === "off") {
      return;
    }
    await app.mock.computerDoorbell();
  });

  return room;
}
