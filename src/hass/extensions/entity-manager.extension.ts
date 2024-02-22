import dayjs, { Dayjs } from "dayjs";
import { EventEmitter } from "node-cache";
import { Get } from "type-fest";

import {
  each,
  INCREMENT,
  is,
  SECOND,
  sleep,
  START,
  TAnyFunction,
  TBlackHole,
  TServiceParams,
  ZCC,
  ZCC_Testing,
} from "../..";
import {
  ALL_DOMAINS,
  ENTITY_STATE,
  EntityHistoryDTO,
  EntityHistoryResult,
  HASSIO_WS_COMMAND,
  PICK_ENTITY,
} from "..";

type EntityHistoryItem = { a: object; s: unknown; lu: number };
export const ENTITY_UPDATE_RECEIVER = Symbol.for("entityUpdateReceiver");
export type ByIdProxy<ENTITY_ID extends PICK_ENTITY> =
  ENTITY_STATE<ENTITY_ID> & {
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
const UNLIMITED = 0;
const RECENT = 5;

export function EntityManager({ logger, hass, lifecycle }: TServiceParams) {
  // # Local vars
  /**
   * MASTER_STATE.switch.desk_light = {entity_id,state,attributes,...}
   */
  let MASTER_STATE = {} as Partial<
    Record<ALL_DOMAINS, Record<string, ENTITY_STATE<PICK_ENTITY>>>
  >;
  const ENTITY_PROXIES = new Map<PICK_ENTITY, ByIdProxy<PICK_ENTITY>>();
  let lastRefresh: Dayjs;

  // * Local event emitter for coordination of socket events
  // Other libraries will internally take advantage of this eventemitter
  const event = new EventEmitter();
  event.setMaxListeners(UNLIMITED);
  let init = false;

  // # Methods
  // ## Retrieve raw state object for entity
  function getCurrentState<ENTITY_ID extends PICK_ENTITY>(
    entity_id: ENTITY_ID,
    // 🖕 TS
  ): NonNullable<ENTITY_STATE<ENTITY_ID>> {
    return ZCC.utils.object.get(
      MASTER_STATE,
      entity_id,
    ) as ENTITY_STATE<ENTITY_ID>;
  }

  // ## Proxy version of the logic
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
      logger.error({ entity, property }, `invalid property lookup`);
      return undefined;
    }
    const current = getCurrentState(entity);
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
    return ZCC.utils.object.get(current, property) || defaultValue;
  }

  // ## Retrieve a proxy by id
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

  // ## Retrieve entity history (via socket)
  async function history<ENTITES extends PICK_ENTITY[]>(
    payload: Omit<EntityHistoryDTO<ENTITES>, "type">,
  ) {
    logger.trace({ payload }, `looking up entity history`);
    const result = (await hass.socket.sendMessage({
      ...payload,
      end_time: dayjs(payload.end_time).toISOString(),
      start_time: dayjs(payload.start_time).toISOString(),
      type: HASSIO_WS_COMMAND.history_during_period,
    })) as Record<PICK_ENTITY, EntityHistoryItem[]>;

    const entities = Object.keys(result) as PICK_ENTITY[];
    return Object.fromEntries(
      entities.map((entity_id: PICK_ENTITY) => {
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

  // ## Build a string array of all known entity ids
  function listEntities(): PICK_ENTITY[] {
    return Object.keys(MASTER_STATE).flatMap(domain =>
      Object.keys(MASTER_STATE[domain as ALL_DOMAINS]).map(
        id => `${domain}.${id}` as PICK_ENTITY,
      ),
    );
  }

  // ## Gather all entity proxies for a domain
  function findByDomain<DOMAIN extends ALL_DOMAINS>(domain: DOMAIN) {
    return Object.keys(MASTER_STATE[domain] ?? {}).map(i =>
      byId(`${domain}.${i}` as PICK_ENTITY),
    );
  }

  // ## Load all entity state information from hass
  async function refresh(recursion = START): Promise<void> {
    const now = dayjs();
    if (lastRefresh) {
      const diff = lastRefresh.diff(now, "ms");
      if (diff >= RECENT * SECOND) {
        logger.warn({ diff }, `multiple refreshes in close time`);
      }
    }
    lastRefresh = now;
    // - Fetch list of entities
    const states = await hass.fetch.getAllEntities();
    // - Keep retrying until max failures reached
    if (is.empty(states)) {
      if (recursion > MAX_ATTEMPTS) {
        logger.fatal(
          `failed to load service list from Home Assistant. Validate configuration`,
        );
        ZCC_Testing.FailFast();
      }
      logger.warn(
        "failed to retrieve entity list. Retrying {%s}/[%s]",
        recursion,
        MAX_ATTEMPTS,
      );
      await sleep(FAILED_LOAD_DELAY * SECOND);
      await refresh(recursion + INCREMENT);
      return;
    }

    // - Preserve old state for comparison
    const oldState = MASTER_STATE;
    MASTER_STATE = {};
    const emitUpdates: ENTITY_STATE<PICK_ENTITY>[] = [];

    // - Go through all entities, setting the state
    // ~ If this is a refresh (not an initial boot), track what changed so events can be emitted
    states.forEach(entity => {
      // ? Set first, ensure data is populated
      // `nextTick` will fire AFTER loop finishes
      ZCC.utils.object.set(
        MASTER_STATE,
        entity.entity_id,
        entity,
        is.undefined(ZCC.utils.object.get(oldState, entity.entity_id)),
      );
      if (!init) {
        return;
      }
      const old = ZCC.utils.object.get(oldState, entity.entity_id);
      if (is.equal(old, entity)) {
        logger.trace({ name: entity.entity_id }, `no change on refresh`);
        return;
      }
      emitUpdates.push(entity);
    });

    // Attempt to not blow up the system?
    // TODO: does this gain anything? is a debounce needed somewhere else instead?
    setImmediate(async () => {
      await each(
        emitUpdates,
        async entity =>
          await EntityUpdateReceiver(
            entity.entity_id,
            entity as ENTITY_STATE<PICK_ENTITY>,
            ZCC.utils.object.get(oldState, entity.entity_id),
          ),
      );
    });
    init = true;
  }

  // ## is.entity definition
  // Actually tie the type casting to real state
  is.entity = (entityId: PICK_ENTITY): entityId is PICK_ENTITY =>
    is.undefined(ZCC.utils.object.get(MASTER_STATE, entityId));

  // ## Receiver function for incoming entity updates
  function EntityUpdateReceiver<ENTITY extends PICK_ENTITY = PICK_ENTITY>(
    entity_id: PICK_ENTITY,
    new_state: ENTITY_STATE<ENTITY>,
    old_state: ENTITY_STATE<ENTITY>,
  ) {
    if (new_state === null) {
      logger.warn(
        { name: entity_id },
        `removing deleted entity from {MASTER_STATE}`,
      );
      ZCC.utils.object.del(MASTER_STATE, entity_id);
      return;
    }
    ZCC.utils.object.set(MASTER_STATE, entity_id, new_state);
    event.emit(entity_id, new_state, old_state);
  }

  lifecycle.onPostConfig(async () => {
    logger.debug(`pre populate {MASTER_STATE}`);
    await refresh();
  });

  return {
    /**
     * Internal library use only
     */
    [ENTITY_UPDATE_RECEIVER]: EntityUpdateReceiver,
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

declare module "../../utilities" {
  export interface IsIt {
    entity(entity: PICK_ENTITY): entity is PICK_ENTITY;
  }
}
