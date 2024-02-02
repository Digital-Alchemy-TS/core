import { ALL_GENERATED_SERVICE_DOMAINS } from "@zcc/hass";

import { SensorDeviceClasses } from "./device-class.helper";
import { PICK_GENERATED_ENTITY } from "./utility.helper";

interface Base {
  attributes?: Record<string, Template>;
  availability?: Template;
  icon?: Icon;
  name?: string;
  unique_id?: string;
}

export type Timer = Record<string, number>;

type Action = unknown;
export type Template = string;
export type Icon = string;

export type SensorTemplate = Base &
  SensorDeviceClasses & {
    picture?: Template;
    state: Template;
    state_class?: "measurement" | "total" | "total_increasing";
  };

export type BinarySensorTemplate = Base &
  Pick<SensorDeviceClasses, "device_class"> & {
    auto_off?: Timer;
    delay_off?: Timer;
    delay_on?: Timer;
    picture?: Template;
    state: Template;
  };

export type NumberTemplate = Base & {
  max?: Template;
  min?: Template;
  optimistic?: boolean;
  set_value: Action;
  state: Template;
  step: Template;
};

export type SelectTemplate = Base & {
  optimistic?: boolean;
  options: Template;
  select_action: Action;
  state: Template;
};

export type ButtonTemplate = Base & {
  press: Action;
};

export type SensorTemplateYaml = {
  sensor: SensorTemplate[];
  trigger: unknown[];
};

export type ButtonTemplateYaml = {
  button: ButtonTemplate[];
};

export type BinarySensorTemplateYaml = {
  binary_sensor: BinarySensorTemplate[];
  trigger: unknown[];
};

export type SwitchTemplateYaml = {
  availability_template?: Template;
  entity_picture_template?: Template;
  friendly_name?: string;
  icon_template?: Template;
  turn_off: Action;
  turn_on: Action;
  unique_id?: string;
  value_template?: Template;
};

export type TemplateYaml =
  | SensorTemplateYaml
  | BinarySensorTemplateYaml
  | SwitchTemplateYaml
  | ButtonTemplateYaml
  | SelectTemplate
  | NumberTemplate;
//

export const GET_STATE_TEMPLATE = `{{ trigger.json.state }}`;
export const GET_ATTRIBUTE_TEMPLATE = (attribute: string) =>
  `{{ trigger.json.attributes.${attribute} }}`;
export type StorageData<CONFIG extends object = object> = {
  attributes: Record<string, unknown>;
  config: CONFIG;
  state: unknown;
};

export const UPDATE_TRIGGER = (
  domain: ALL_GENERATED_SERVICE_DOMAINS,
  sensor_id: string,
) => {
  if (!sensor_id.includes(".")) {
    sensor_id = domain + "." + sensor_id;
  }
  return [
    {
      local_only: true,
      platform: "webhook",
      webhook_id: UPDATE_TRIGGER.event(
        sensor_id as PICK_GENERATED_ENTITY<ALL_GENERATED_SERVICE_DOMAINS>,
      ),
    },
  ];
};

UPDATE_TRIGGER.event = (
  entity: PICK_GENERATED_ENTITY<ALL_GENERATED_SERVICE_DOMAINS>,
) => `digital_alchemy_${entity.replace(".", "_")}_update`;

export const TALK_BACK_ACTION = (webhook_id: string) => {
  return [
    {
      local_only: true,
      platform: "webhook",
      webhook_id,
    },
  ];
};

TALK_BACK_ACTION.event = (
  entity: PICK_GENERATED_ENTITY<ALL_GENERATED_SERVICE_DOMAINS>,
  action: string,
) => `digital_alchemy_${entity}_talk_back_${action}`;
