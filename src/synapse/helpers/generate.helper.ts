import { FetchWith } from "../../boilerplate";
import { SensorDeviceClasses } from "./device-class.helper";
import { Icon, Template, Timer } from "./template.helper";

type SensorValueType = string;

export type SensorConfig = {
  attributes?: Record<string, SensorValueType>;
  auto_off?: Timer;
  delay_off?: Timer;
  delay_on?: Timer;
} & SensorDeviceClasses &
  BaseVirtualEntityConfig;

/**
 * TODO: VALIDATE ME
 */
export type BinarySensorConfig = {
  attributes?: Record<string, SensorValueType>;
  auto_off?: Timer;
  delay_off?: Timer;
  delay_on?: Timer;
} & SensorDeviceClasses &
  BaseVirtualEntityConfig;

export interface BaseVirtualEntityConfig {
  availability?: Template;
  icon?: Icon;
  name?: string;
  track_history?: boolean;
}

export type SwitchConfig = BaseVirtualEntityConfig;
export type ButtonConfig = BaseVirtualEntityConfig & {
  /**
   * **Note:** Default operation causes button to bind to a `@TemplateButton` annotation.
   * Providing this value will break annotation functionality.
   *
   * Cause the button to send a http request to a custom target.
   * Urls will attempt to generate in a way that resolves to this application, using `ADMIN_KEY` based auth, unless overridden
   */
  target?: FetchWith;
};

export interface GenerateEntities {
  /**
   * Binary sensors will not be created unless they are also injected using `@InjectPushEntity`
   */
  binary_sensor?: Record<string, BinarySensorConfig>;
  /**
   * Buttons will be created on load.
   *
   * Annotate methods with `@TemplateButton` to receive activation events
   */
  button?: Record<string, ButtonConfig>;
  /**
   * Binary sensors will not be created unless they are also injected.
   *
   * Use `@InjectPushEntity` + `
   */
  sensor?: Record<string, SensorConfig>;
  /**
   * Switches are created on load.
   *
   * Use standard api commands to manage state
   */
  switch?: Record<string, SwitchConfig>;
}

export interface HomeAssistantModuleConfiguration {
  controllers?: boolean;
  generate_entities?: GenerateEntities;
}
