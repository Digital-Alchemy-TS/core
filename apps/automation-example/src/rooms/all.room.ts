/* eslint-disable @typescript-eslint/no-magic-numbers */
import { LIB_AUTOMATION_LOGIC } from "@zcc/automation-logic";
import { TServiceParams } from "@zcc/boilerplate";
import dayjs from "dayjs";

import { AUTOMATION_EXAMPLE_APP } from "../main";

const BASICALLY_NOW = 10;

export function AllRooms({ getApis, context }: TServiceParams) {
  //
  // imports & definitions
  //
  const app = getApis(AUTOMATION_EXAMPLE_APP);
  const automation = getApis(LIB_AUTOMATION_LOGIC);

  const list = ["office", "bed", "bedroom", "living", "desk"] as const;

  async function globalOff() {
    app.living.scene = "off";
    app.office.scene = "off";
    app.bed.scene = "off";
  }

  /**
   * Mental note: this does not properly respect high vs evening high type distinctions
   *
   * It serves a "make everything bright" role
   */
  async function globalOn() {
    app.living.scene = "high";
    app.office.scene = "high";
    app.bed.scene = "high";
  }

  /**
   * Keep away tricker or treaters!
   *
   * Unless I'm having a party, and am expecting you
   */
  const keepLightsOff = () => {
    if (app.sensors.guestMode.on) {
      return false;
    }
    const halloween = new Date();
    halloween.setMonth(10);
    halloween.setDate(1);
    halloween.setHours(0);

    const NOW = dayjs();
    if (Math.abs(NOW.diff(halloween, "hour")) <= BASICALLY_NOW) {
      return true;
    }
    return false;
  };

  automation.managedSwitch({
    context,
    entity_id: "switch.front_porch_light",
    shouldBeOn() {
      if (keepLightsOff()) {
        return false;
      }
      return !automation.solar.isBetween("dawn", "dusk");
    },
  });

  list.forEach(i => {
    // You know how nice it is to push the secret code on any switch, and your phone rings?!
    app.pico[i]({
      context,
      exec: async () => await app.mock.findPhone(),
      match: ["stop", "lower", "raise"],
    });

    app.pico[i]({
      context,
      exec: async () => await globalOff(),
      match: ["off", "off"],
    });

    app.pico[i]({
      context,
      exec: async () => await globalOn(),
      match: ["on", "on"],
    });
  });

  return {
    globalOff,
    globalOn,
  };
}
