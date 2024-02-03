import { MINUTE, ZCC } from "@zcc/utilities";

import { BinarySensor, Button, Sensor, Switch } from ".";

export const LIB_VIRTUAL_ENTITY = ZCC.createLibrary({
  configuration: {
    BASE_URL: {
      default: "http://192.168.1.1:7000",
      description: "Base url to use with callbacks in home assistant",
      type: "string",
    },
    HTTP_PREFIX: {
      default: "/talk-back",
      description:
        "URL prefix to use for asking home assistant to communicate back",
      type: "string",
    },
    REPEAT_VALUE: {
      default: 5 * MINUTE,
      description: "How often to re-send values to home assistant",
      type: "number",
    },
  },
  name: "virtual-entity",
  services: {
    binary_sensor: BinarySensor,
    button: Button,
    sensor: Sensor,
    switch: Switch,
  },
});
