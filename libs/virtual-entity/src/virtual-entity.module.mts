import { MINUTE, ZCC } from "@zcc/utilities";

export const LIB_VIRTUAL_ENTITY = ZCC.createLibrary({
  configuration: {
    REPEAT_VALUE: {
      default: 5 * MINUTE,
      description: "How often to re-send values to home assistant",
      type: "number",
    },
  },
  name: "virtual-entity",
  services: {},
});
