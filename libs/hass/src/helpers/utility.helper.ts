import { is, TBlackHole } from "@zcc/utilities";
import type { Get } from "type-fest";

import { ENTITY_SETUP, iCallService } from "../dynamic";

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

// export const isDomain = <
//   DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS = ALL_GENERATED_SERVICE_DOMAINS,
// >(
//   entity: PICK_GENERATED_ENTITY,
//   domain: DOMAIN,
// ): entity is PICK_GENERATED_ENTITY<DOMAIN> =>
//   generated_domain(entity) === domain;

// export const isGeneratedDomain = <
//   DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS = ALL_GENERATED_SERVICE_DOMAINS,
// >(
//   entity: PICK_GENERATED_ENTITY,
//   domain: DOMAIN,
// ): entity is PICK_GENERATED_ENTITY<DOMAIN> =>
//   generated_domain(entity) === domain;

export type GetDomain<ENTITY extends PICK_ENTITY> =
  ENTITY extends `${infer domain}.${string}` ? domain : never;

is.domain = <DOMAIN extends string>(
  entity: PICK_ENTITY,
  domain: DOMAIN,
): entity is PICK_ENTITY<DOMAIN> => {
  const [entityDomain] = entity.split(".");
  return entityDomain === domain;
};

declare module "@zcc/utilities" {
  export interface IsIt {
    domain: <DOMAIN extends string>(
      entity: PICK_ENTITY,
      domain: DOMAIN,
    ) => entity is PICK_ENTITY<DOMAIN>;
  }
}
