import { is, TBlackHole } from "@zcc/utilities";
import type { Get } from "type-fest";

import { ENTITY_SETUP, iCallService, MODULE_SETUP } from "../../dynamic.mjs";

type generated = typeof MODULE_SETUP.generate_entities;

/**
 * Pick any entity that home assistant wants to create, optionally limiting by type
 */
export type PICK_GENERATED_ENTITY<
  DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS = ALL_GENERATED_SERVICE_DOMAINS,
> = {
  [key in DOMAIN]: `${key}.${keyof generated[key] & string}`;
}[DOMAIN];

/**
 * Pick any valid entity, optionally limiting by domain
 */
export type PICK_ENTITY<DOMAIN extends ALL_DOMAINS = ALL_DOMAINS> = {
  [key in DOMAIN]: `${key}.${keyof (typeof ENTITY_SETUP)[key] & string}`;
}[DOMAIN];

/**
 * Pick any valid entity, optionally limiting by domain
 */
export type PICK_SERVICE<
  DOMAIN extends ALL_SERVICE_DOMAINS = ALL_SERVICE_DOMAINS,
> = {
  [key in DOMAIN]: `${key}.${keyof iCallService[key] & string}`;
}[DOMAIN];

export type PICK_SERVICE_PARAMETERS<SERVICE extends PICK_SERVICE> =
  Get<iCallService, SERVICE> extends (
    serviceParams: infer ServiceParams,
  ) => TBlackHole
    ? ServiceParams
    : never;

export function entity_split(
  entity: { entity_id: PICK_ENTITY } | PICK_ENTITY,
): [ALL_DOMAINS, string] {
  if (is.object(entity)) {
    entity = entity.entity_id;
  }
  return entity.split(".") as [ALL_DOMAINS, string];
}
export function generated_entity_split(entity: PICK_GENERATED_ENTITY) {
  return entity.split(".") as [ALL_GENERATED_SERVICE_DOMAINS, string];
}

/**
 * Extract the domain from an entity with type safety
 */
export function domain(
  entity: { entity_id: PICK_ENTITY } | PICK_ENTITY,
): ALL_DOMAINS {
  if (is.object(entity)) {
    entity = entity.entity_id;
  }
  return entity_split(entity).shift();
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
  return is.undefined(PushProxyDomains[domain]);
}

export type PUSH_PROXY<
  ENTITY extends PICK_GENERATED_ENTITY<PUSH_PROXY_DOMAINS>,
> = {
  binary_sensor: BinarySensorProxy;
  sensor: SensorProxy;
  switch: SwitchProxy;
}[GetDomain<ENTITY>];

/**
 * Type definitions to match a specific entity.
 *
 * Use with `@InjectEntityProxy("some.entity")` to create proxy objects that always match the current state.
 */
export type ENTITY_STATE<ENTITY_ID extends PICK_ENTITY> = Get<
  typeof ENTITY_SETUP,
  ENTITY_ID
>;

/**
 * Union of all domains that contain entities
 */
export type ALL_DOMAINS = keyof typeof ENTITY_SETUP;

/**
 * Union of all services with callable methods
 */
export type ALL_SERVICE_DOMAINS = keyof iCallService;

export type ALL_GENERATED_SERVICE_DOMAINS = Extract<keyof generated, string>;

export const isDomain = <
  DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS = ALL_GENERATED_SERVICE_DOMAINS,
>(
  entity: PICK_GENERATED_ENTITY,
  domain: DOMAIN,
): entity is PICK_GENERATED_ENTITY<DOMAIN> =>
  generated_domain(entity) === domain;

export const isGeneratedDomain = <
  DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS = ALL_GENERATED_SERVICE_DOMAINS,
>(
  entity: PICK_GENERATED_ENTITY,
  domain: DOMAIN,
): entity is PICK_GENERATED_ENTITY<DOMAIN> =>
  generated_domain(entity) === domain;

type PushSensorDomains = "sensor" | "binary_sensor";

type GetGeneratedStateType<DOMAIN extends PushSensorDomains> = {
  binary_sensor: boolean;
  sensor: unknown;
}[DOMAIN];

export type iPushSensor<
  ENTITY extends PICK_GENERATED_ENTITY<PushSensorDomains>,
> = {
  state: GetGeneratedStateType<GetDomain<ENTITY>>;
};

export type GetDomain<ENTITY extends PICK_ENTITY | PICK_GENERATED_ENTITY> =
  ENTITY extends `${infer domain}.${string}` ? domain : never;

export type ConfigDomainMap = {
  binary_sensor: BinarySensorConfig;
  button: ButtonConfig;
  sensor: SensorConfig;
  switch: SwitchConfig;
};

export type GET_CONFIG<DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS> =
  ConfigDomainMap[DOMAIN];
