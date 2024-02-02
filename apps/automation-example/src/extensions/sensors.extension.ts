import { TServiceParams } from "@zcc/boilerplate";
import { LIB_VIRTUAL_ENTITY } from "@zcc/virtual-entity";

export function SensorsExtension({ getApis, context }: TServiceParams) {
  const virtual = getApis(LIB_VIRTUAL_ENTITY);
  return {
    guestMode: virtual.switch({
      context,
      id: "guest_mode",
      name: "Guest Mode",
    }),
    isHome: virtual.binary_sensor({
      context,
      id: "is_home",
      name: "Is Home",
    }),
    meetingMode: virtual.switch({
      context,
      id: "meeting_mode",
      name: "Meeting Mode",
    }),
  };
}
