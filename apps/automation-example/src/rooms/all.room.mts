import { TServiceParams } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/home-assistant";

import { AUTOMATION_EXAMPLE_APP } from "../main.mjs";

export function AllRooms({ getApis, context }: TServiceParams) {
  //
  // imports & definitions
  //
  const app = getApis(AUTOMATION_EXAMPLE_APP);
  const hass = getApis(LIB_HOME_ASSISTANT);

  const list = ["office", "bed", "bedroom", "living", "desk"] as const;

  async function GlobalOff() {
    await hass.call.scene.turn_on({
      entity_id: ["scene.bedroom_off", "scene.living_off", "scene.office_off"],
    });
  }

  /**
   * Mental note: this does not properly respect high vs evening high type distinctions
   *
   * It serves a "make everything bright" role
   */
  async function GlobalOn() {
    await hass.call.scene.turn_on({
      entity_id: [
        "scene.bedroom_high",
        "scene.living_high",
        "scene.office_high",
      ],
    });
  }

  list.forEach(i => {
    // You know how nice it is to push the secret code on any switch, and your phone rings?!
    app.pico[i]({
      context,
      exec: async () => await app.mock.findPhone(),
      match: ["stop", "lower", "raise"],
    });

    app.pico[i]({
      context,
      exec: async () => await GlobalOff(),
      match: ["off", "off"],
    });

    app.pico[i]({
      context,
      exec: async () => await GlobalOn(),
      match: ["on", "on"],
    });
  });

  return {
    GlobalOff,
    GlobalOn,
  };
}
