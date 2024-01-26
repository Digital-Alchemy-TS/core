import { TServiceParams } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/home-assistant";
import { get, set } from "object-path";
import { nextTick } from "process";

import { StorageData } from "../helpers/template.helper.mjs";
import {
  ALL_GENERATED_SERVICE_DOMAINS,
  GET_CONFIG,
  PICK_GENERATED_ENTITY,
  PUSH_PROXY,
  PUSH_PROXY_DOMAINS,
} from "../helpers/utility.helper.mjs";
import { LIB_VIRTUAL_ENTITY } from "../virtual-entity.module.mjs";

type ProxyOptions = {
  getter?: (property: string) => unknown;
  validate: (property: string, value: unknown) => boolean;
};
type MergeAndEmit<
  STATE extends unknown = unknown,
  ATTRIBUTES extends object = object,
> = {
  attributes?: ATTRIBUTES;
  state?: STATE;
};

type ProxyMapValue<DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS> =
  DOMAIN extends PUSH_PROXY_DOMAINS
    ? PUSH_PROXY<PICK_GENERATED_ENTITY<DOMAIN>>
    : undefined;

const CACHE_KEY = (id: string) => `push_entity:${id}`;
const LOG_CONTEXT = (entity_id: PICK_GENERATED_ENTITY) => {
  const [domain, id] = entity_id.split(".");
  const tag = "Push" + domain;
  return `${tag}(${id})`;
};

const STORAGE: PushStorageMap = new Map();

export type PushStorageMap<
  DOMAIN extends PUSH_PROXY_DOMAINS = PUSH_PROXY_DOMAINS,
> = Map<PICK_GENERATED_ENTITY<DOMAIN>, StorageData<GET_CONFIG<DOMAIN>>>;

const proxyMap = new Map<
  PICK_GENERATED_ENTITY<PUSH_PROXY_DOMAINS>,
  ProxyMapValue<PUSH_PROXY_DOMAINS>
>();
const proxyOptions = new Map<
  PICK_GENERATED_ENTITY<PUSH_PROXY_DOMAINS>,
  ProxyOptions
>();

/**
 * TODO: Update type to emit errors if using a hard coded id
 */
export type NewEntityId<CREATE_DOMAIN extends ALL_GENERATED_SERVICE_DOMAINS> =
  `${CREATE_DOMAIN}.${string}`;

type SettableProperties = "state" | `attributes.${string}`;

export function PushExtension({
  logger,
  lifecycle,
  cache,
  scheduler,
  context,
  getApis,
}: TServiceParams) {
  let repeat: number;
  const hass = getApis(LIB_HOME_ASSISTANT);

  lifecycle.onPostConfig(() => {
    repeat = LIB_VIRTUAL_ENTITY.getConfig("REPEAT_VALUE");
  });

  lifecycle.onBootstrap(() => {
    //
  });

  scheduler({
    context,
    exec: () => {
      logger.trace(`Repeat values`);
    },
    interval: repeat,
  });

  function insert() {
    logger.debug(`Insert entity`);
  }

  function proxyGet<DOMAIN extends PUSH_PROXY_DOMAINS = PUSH_PROXY_DOMAINS>(
    entity: PICK_GENERATED_ENTITY<DOMAIN>,
    property: string,
  ) {
    const options = proxyOptions.get(entity);
    if (options.getter) {
      return options.getter(property);
    }
    return get(get(entity), property);
  }

  function proxySet<DOMAIN extends PUSH_PROXY_DOMAINS = PUSH_PROXY_DOMAINS>(
    entity: PICK_GENERATED_ENTITY<DOMAIN>,
    property: SettableProperties,
    value: unknown,
  ): boolean {
    const options = proxyOptions.get(entity);
    const status = options.validate(property, value);
    if (!status) {
      logger.error({ entity, value }, `Value failed validation`);
      return false;
    }
    const update = {};
    set(update, property, value);
    nextTick(async () => await emitUpdate(entity, update));
    return true;
  }

  return {
    /**
     * Insert an entity into the
     */
    insert,
  };
}
