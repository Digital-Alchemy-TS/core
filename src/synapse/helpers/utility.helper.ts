import { is } from "../../utilities";
import {
  BinarySensorConfig,
  ButtonConfig,
  GenerateEntities,
  SensorConfig,
  SwitchConfig,
} from "./generate.helper";

export const MODULE_SETUP: GenerateEntities = {};

type generated = typeof MODULE_SETUP;

export type ALL_GENERATED_SERVICE_DOMAINS = Extract<keyof generated, string>;
/**
 * Pick any entity that home assistant wants to create, optionally limiting by type
 */
export type PICK_GENERATED_ENTITY<
  DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS = ALL_GENERATED_SERVICE_DOMAINS,
> = {
  [key in DOMAIN]: `${key}.${keyof generated[key] & string}`;
}[DOMAIN];

export function generated_entity_split(entity: PICK_GENERATED_ENTITY) {
  return entity.split(".") as [ALL_GENERATED_SERVICE_DOMAINS, string];
}

/**
 * Extract the domain from an entity with type safety
 */
export function generated_domain(
  entity: { entity_id: PICK_GENERATED_ENTITY } | PICK_GENERATED_ENTITY,
): ALL_GENERATED_SERVICE_DOMAINS {
  if (is.object(entity)) {
    entity = entity.entity_id;
  }
  const [domain] = generated_entity_split(entity);
  return domain;
}

type SwitchProxy = {
  state: boolean;
};
type SensorProxy = {
  attributes: Record<string, unknown>;
  state: number | string;
};
type BinarySensorProxy = {
  attributes: Record<string, unknown>;
  state: boolean;
};

export enum PushProxyDomains {
  switch = "switch",
  sensor = "sensor",
  binary_sensor = "binary_sensor",
}

export type PUSH_PROXY_DOMAINS = `${PushProxyDomains}`;
export function IsPushDomain(domain: string): domain is PushProxyDomains {
  return is.undefined(PushProxyDomains[domain as `${PushProxyDomains}`]);
}

export type PUSH_PROXY<
  ENTITY extends PICK_GENERATED_ENTITY<PUSH_PROXY_DOMAINS>,
> = {
  binary_sensor: BinarySensorProxy;
  sensor: SensorProxy;
  switch: SwitchProxy;
}[GetGeneratedDomain<ENTITY>];

type PushSensorDomains = "sensor" | "binary_sensor";

type GetGeneratedStateType<DOMAIN extends PushSensorDomains> = {
  binary_sensor: boolean;
  sensor: unknown;
}[DOMAIN];

export type GetGeneratedDomain<ENTITY extends `${string}.${string}`> =
  ENTITY extends `${infer domain}.${string}` ? domain : never;

export type iPushSensor<
  ENTITY extends PICK_GENERATED_ENTITY<PushSensorDomains>,
> = {
  state: GetGeneratedStateType<GetGeneratedDomain<ENTITY>>;
};

export type GET_CONFIG<DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS> =
  ConfigDomainMap[DOMAIN];

export type ConfigDomainMap = {
  binary_sensor: BinarySensorConfig;
  button: ButtonConfig;
  sensor: SensorConfig;
  switch: SwitchConfig;
};
export type OnOff = "on" | "off";
