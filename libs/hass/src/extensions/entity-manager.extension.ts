import { TServiceParams } from "@zcc/boilerplate";
import {
  INCREMENT,
  is,
  SECOND,
  sleep,
  START,
  TAnyFunction,
  TBlackHole,
  ZCC_Testing,
} from "@zcc/utilities";
import { eachLimit } from "async";
import dayjs from "dayjs";
import { EventEmitter } from "eventemitter3";
import { get, set } from "object-path";
import { Get } from "type-fest";

import { LIB_HOME_ASSISTANT } from "../hass.module";
import {
  ALL_DOMAINS,
  ENTITY_STATE,
  EntityHistoryDTO,
  EntityHistoryResult,
  GenericEntityDTO,
  HASSIO_WS_COMMAND,
  PICK_ENTITY,
} from "../helpers/index";

type EntityHistoryItem = { a: object; s: unknown; lu: number };
type ByIdProxy<ENTITY_ID extends PICK_ENTITY> = ENTITY_STATE<ENTITY_ID> & {
  entity_id: ENTITY_ID;
  /**
   * Run callback
   */
  onUpdate: (
    callback: (state: NonNullable<ENTITY_STATE<ENTITY_ID>>) => TBlackHole,
  ) => void;
  /**
   * Run callback once, for next update
   */
  once: (
    callback: (state: NonNullable<ENTITY_STATE<ENTITY_ID>>) => TBlackHole,
  ) => void;
  /**
   * Will resolve with the next state of the next value. No time limit
   */
  nextState: () => Promise<ENTITY_STATE<ENTITY_ID>>;
};

const MAX_ATTEMPTS = 50;
const FAILED_LOAD_DELAY = 5;
const BOTTLENECK_UPDATES = 20;

export function EntityManager({ logger, getApis }: TServiceParams) {
  const hass = getApis(LIB_HOME_ASSISTANT);

  /**
   * MASTER_STATE.switch.desk_light = {entity_id,state,attributes,...}
   */
  let MASTER_STATE: Record<
    ALL_DOMAINS,
    Record<string, ENTITY_STATE<PICK_ENTITY>>
  > = {};

  const event = new EventEmitter();

  let init = false;

  function proxyGetLogic<
    ENTITY extends PICK_ENTITY = PICK_ENTITY,
    PROPERTY extends string = string,
  >(entity: ENTITY, property: PROPERTY): Get<ENTITY_STATE<ENTITY>, PROPERTY> {
    if (!init) {
      return undefined;
    }
    const valid = ["state", "attributes", "last"].some(i =>
      property.startsWith(i),
    );
    if (!valid) {
      return undefined;
    }
    const current = byId<ENTITY>(entity);
    const defaultValue = (property === "state" ? undefined : {}) as Get<
      ENTITY_STATE<ENTITY>,
      PROPERTY
    >;
    if (!current) {
      logger.error(
        { defaultValue, name: entity, property },
        `proxyGetLogic cannot find entity`,
      );
    }
    return get(current, property, defaultValue);
  }

  const ENTITY_PROXIES = new Map<PICK_ENTITY, ByIdProxy<PICK_ENTITY>>();

  function byId<ENTITY_ID extends PICK_ENTITY>(
    entity_id: ENTITY_ID,
  ): ByIdProxy<ENTITY_ID> {
    if (!ENTITY_PROXIES.has(entity_id)) {
      ENTITY_PROXIES.set(
        entity_id,
        new Proxy({ entity_id } as ByIdProxy<ENTITY_ID>, {
          // things that shouldn't be needed: this extract
          get: (_, property: Extract<keyof ByIdProxy<ENTITY_ID>, string>) => {
            if (property === "onUpdate") {
              return (callback: TAnyFunction) =>
                event.on(entity_id, async (a, b) => callback(a, b));
            }
            if (property === "once") {
              return (callback: TAnyFunction) =>
                event.once(entity_id, async (a, b) => callback(a, b));
            }
            if (property === "entity_id") {
              return entity_id;
            }
            if (property === "nextState") {
              return new Promise<ENTITY_STATE<ENTITY_ID>>(done => {
                event.once(entity_id, (entity: ENTITY_STATE<ENTITY_ID>) =>
                  done(entity as ENTITY_STATE<ENTITY_ID>),
                );
              });
            }
            return proxyGetLogic(entity_id, property);
          },
        }),
      );
    }
    return ENTITY_PROXIES.get(entity_id) as ByIdProxy<ENTITY_ID>;
  }

  function getCurrentState<ENTITY_ID extends PICK_ENTITY>(
    entity_id: ENTITY_ID,
    // 🖕 TS
  ): NonNullable<ENTITY_STATE<ENTITY_ID>> {
    return get(MASTER_STATE, entity_id);
  }

  async function history<ENTITES extends PICK_ENTITY[]>(
    payload: Omit<EntityHistoryDTO<ENTITES>, "type">,
  ) {
    logger.trace(`Finding stuff`);
    const result = (await hass.socket.sendMessage({
      ...payload,
      end_time: dayjs(payload.end_time).toISOString(),
      start_time: dayjs(payload.start_time).toISOString(),
      type: HASSIO_WS_COMMAND.history_during_period,
    })) as Record<PICK_ENTITY, EntityHistoryItem[]>;

    return Object.fromEntries(
      Object.keys(result).map((entity_id: PICK_ENTITY) => {
        const key = entity_id;
        const states = result[entity_id];
        const value = states.map(data => {
          return {
            attributes: data.a,
            date: new Date(data.lu * SECOND),
            state: data.s,
          } as EntityHistoryResult;
        });
        return [key, value];
      }),
    );
  }

  function listEntities(): PICK_ENTITY[] {
    return Object.keys(MASTER_STATE).flatMap(domain =>
      Object.keys(MASTER_STATE[domain]).map(
        id => `${domain}.${id}` as PICK_ENTITY,
      ),
    );
  }

  function findByDomain<DOMAIN extends ALL_DOMAINS>(domain: DOMAIN) {
    return Object.keys(MASTER_STATE[domain] ?? {}).map(i =>
      byId(`${domain}.${i}`),
    );
  }

  function getEntities<
    T extends ENTITY_STATE<PICK_ENTITY> = ENTITY_STATE<PICK_ENTITY>,
  >(entityId: PICK_ENTITY[]): T[] {
    return entityId.map(id => getCurrentState(id) as T);
  }

  async function refresh(recursion = START): Promise<void> {
    const states = await hass.fetch.getAllEntities();
    if (is.empty(states)) {
      if (recursion > MAX_ATTEMPTS) {
        logger.fatal(
          `Failed to load service list from Home Assistant. Validate configuration`,
        );
        ZCC_Testing.FailFast();
      }
      logger.warn(
        "Failed to retrieve entity list. Retrying {%s}/[%s]",
        recursion,
        MAX_ATTEMPTS,
      );
      await sleep(FAILED_LOAD_DELAY * SECOND);
      await refresh(recursion + INCREMENT);
      return;
    }
    const oldState = MASTER_STATE;
    MASTER_STATE = {};
    const emitUpdates: GenericEntityDTO[] = [];

    states.forEach(entity => {
      // ? Set first, ensure data is populated
      // `nextTick` will fire AFTER loop finishes
      set(
        MASTER_STATE,
        entity.entity_id,
        entity,
        get(oldState, entity.entity_id),
      );
      if (!init) {
        return;
      }
      const old = get(oldState, entity.entity_id);
      if (is.equal(old, entity)) {
        logger.trace({ name: entity.entity_id }, `no change on refresh`);
        return;
      }
      emitUpdates.push(entity);
    });

    setImmediate(async () => {
      await eachLimit(
        emitUpdates,
        BOTTLENECK_UPDATES,
        async entity =>
          await entityUpdateReceiver(
            entity.entity_id,
            entity,
            get(oldState, entity.entity_id),
          ),
      );
    });
    init = true;
  }

  is.entity = (entityId: PICK_ENTITY): entityId is PICK_ENTITY =>
    is.undefined(get(MASTER_STATE, entityId));

  /**
   * Receiver function for incoming entity updates
   *
   * Internal use only, unless you like to watch the world burn
   */
  function entityUpdateReceiver<ENTITY extends PICK_ENTITY = PICK_ENTITY>(
    entity_id: PICK_ENTITY,
    new_state: ENTITY_STATE<ENTITY>,
    old_state: ENTITY_STATE<ENTITY>,
  ) {
    set(MASTER_STATE, entity_id, new_state);
    event.emit(entity_id, new_state, old_state);
  }

  return {
    /**
     * Internal library use only
     */
    [Symbol.for("entityUpdateReceiver")]: entityUpdateReceiver,
    /**
     * Retrieves a proxy object for a specified entity. This proxy object
     * provides current values and event hooks for the entity.
     */
    byId,

    /**
     * Lists all entities within a specified domain. This is useful for
     * domain-specific operations or queries.
     */
    findByDomain,

    /**
     * Retrieves the current state of a given entity. This method returns
     * raw data, offering a direct view of the entity's state at a given moment.
     */
    getCurrentState,

    /**
     * Fetches the state of multiple entities based on their IDs. This is
     * beneficial for bulk operations or comparisons across different entities.
     */
    getEntities,

    /**
     * Retrieves the historical state data of entities over a specified time
     * period. Useful for analysis or tracking changes over time.
     */
    history,

    /**
     * Provides a simple listing of all entity IDs. Useful for enumeration
     * and quick reference to all available entities.
     */
    listEntities,

    /**
     * Initiates a refresh of the current entity states. Useful for ensuring
     * synchronization with the latest state data from Home Assistant.
     */
    refresh,
  };
}

declare module "@zcc/utilities" {
  export interface IsIt {
    entity(entity: PICK_ENTITY): entity is PICK_ENTITY;
  }
}
