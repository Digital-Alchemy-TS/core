import { LIB_AUTOMATION_LOGIC } from "@zcc/automation-logic";
import { TServiceParams } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/home-assistant";
import { HOUR } from "@zcc/utilities";

import { AUTOMATION_EXAMPLE_APP } from "../main";

export function BedRoom({ getApis, context }: TServiceParams) {
  //
  // imports & definitions
  //
  const app = getApis(AUTOMATION_EXAMPLE_APP);
  const automation = getApis(LIB_AUTOMATION_LOGIC);
  const hass = getApis(LIB_HOME_ASSISTANT);

  //
  // general functions
  //

  async function napTime() {
    await app.global.globalOff();
    await app.mock.playWhiteNoise();
    setTimeout(async () => {
      room.scene = "high";
      await app.mock.stopWhiteNoise();
    }, HOUR);
  }

  //
  // the room
  //
  const room = automation.room({
    context,
    id: "bedroom",
    name: "Bedroom",
    scenes: {
      auto: {
        definition: {
          "light.bedroom_ceiling_fan": { brightness: 75, state: "on" },
          "light.dangle": { brightness: 150, state: "on" },
          "light.under_bed": { brightness: 200, state: "on" },
          "light.womp": { brightness: 255, state: "on" },
        },
        friendly_name: "Auto",
      },
      dimmed: {
        definition: {
          "light.bedroom_ceiling_fan": { brightness: 75, state: "on" },
          "light.dangle": { brightness: 150, state: "on" },
          "light.under_bed": { brightness: 200, state: "on" },
          "light.womp": { brightness: 255, state: "on" },
        },
        friendly_name: "Dimmed",
      },
      early: {
        definition: {
          "light.bedroom_ceiling_fan": { brightness: 75, state: "on" },
          "light.dangle": { brightness: 200, state: "on" },
          "light.under_bed": { brightness: 200, state: "on" },
          "light.womp": { brightness: 255, state: "on" },
        },
        friendly_name: "Early",
      },
      high: {
        definition: {
          "light.bedroom_ceiling_fan": { brightness: 255, state: "on" },
          "light.dangle": { brightness: 255, state: "on" },
          "light.under_bed": { brightness: 255, state: "on" },
          "light.womp": { brightness: 255, state: "on" },
        },
        friendly_name: "High",
      },
      high_dimmed: {
        definition: {
          "light.bedroom_ceiling_fan": { brightness: 200, state: "on" },
          "light.dangle": { brightness: 200, state: "on" },
          "light.under_bed": { brightness: 200, state: "on" },
          "light.womp": { brightness: 255, state: "on" },
        },
        friendly_name: "High Dimmed",
      },
      night: {
        definition: {
          "light.bedroom_ceiling_fan": { state: "off" },
          "light.dangle": { state: "off" },
          "light.under_bed": { brightness: 128, state: "on" },
          "light.womp": { brightness: 128, state: "on" },
        },
        friendly_name: "Night",
      },
      night_idle: {
        definition: {
          "light.bedroom_ceiling_fan": { state: "off" },
          "light.dangle": { state: "off" },
          "light.under_bed": { brightness: 32, state: "on" },
          "light.womp": { brightness: 32, state: "on" },
        },
        friendly_name: "Night Idle",
      },
      off: {
        definition: {
          "light.bedroom_ceiling_fan": { state: "off" },
          "light.dangle": { state: "off" },
          "light.under_bed": { state: "off" },
          "light.womp": { state: "off" },
        },
        friendly_name: "Off",
      },
    },
  });

  //
  // entities
  //
  app.pico.bed({
    context,
    exec: async () =>
      await hass.call.fan.increase_speed({
        entity_id: "fan.bedroom_ceiling_fan",
      }),
    match: ["raise", "raise"],
  });

  app.pico.bed({
    context,
    exec: async () =>
      await hass.call.fan.decrease_speed({
        entity_id: "fan.bedroom_ceiling_fan",
      }),
    match: ["lower", "lower"],
  });

  app.pico.bed({
    context,
    exec: async () => await napTime(),
    match: ["stop", "off"],
  });

  app.pico.bed({
    context,
    exec: () => (room.scene = "off"),
    match: ["off"],
  });

  app.pico.bedroom({
    context,
    exec: () => (room.scene = "off"),
    match: ["off"],
  });

  app.pico.bed({
    context,
    exec: () => (room.scene = "high"),
    match: ["on"],
  });

  app.pico.bedroom({
    context,
    exec: () => (room.scene = "high"),
    match: ["on"],
  });

  return room;
}
