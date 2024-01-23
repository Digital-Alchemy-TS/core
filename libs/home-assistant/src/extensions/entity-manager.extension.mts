import { TServiceParams } from "@zcc/boilerplate";
import {
  eachSeries,
  EMPTY,
  INCREMENT,
  is,
  SECOND,
  sleep,
  START,
} from "@zcc/utilities";
import dayjs from "dayjs";
import { get, set } from "object-path";
import { exit, nextTick } from "process";
import { Get } from "type-fest";
import { v4 } from "uuid";

import { HASSIO_WS_COMMAND } from "../helpers/types/constants.helper.mjs";
import { HassEventDTO } from "../helpers/types/entity-state.helper.mjs";
import {
  ALL_DOMAINS,
  ENTITY_STATE,
  PICK_ENTITY,
} from "../helpers/types/utility.helper.mjs";
import {
  EntityHistoryDTO,
  EntityHistoryResult,
} from "../helpers/types/websocket.helper.mjs";
import { LIB_HOME_ASSISTANT } from "../home-assistant.module.mjs";

export type OnHassEventOptions = {
  event_type: string;
  match?: (data: HassEventDTO) => boolean;
};
const MAX_ATTEMPTS = 50;
const FAILED_LOAD_DELAY = 5;
const FAILED = 1;

type WatchFunction<ENTITY_ID extends PICK_ENTITY> = (
  new_state: ENTITY_STATE<ENTITY_ID>,
  old_state: ENTITY_STATE<ENTITY_ID>,
) => Promise<void> | void;

type Watcher<ENTITY_ID extends PICK_ENTITY = PICK_ENTITY> = {
  callback: WatchFunction<ENTITY_ID>;
  id: string;
  type: "once" | "dynamic" | "annotation";
};

export function HAEntityManager({ logger, getApis }: TServiceParams) {
  const hass = getApis(LIB_HOME_ASSISTANT);

  /**
   * MASTER_STATE.switch.desk_light = {entity_id,state,attributes,...}
   */
  let MASTER_STATE: Record<
    ALL_DOMAINS,
    Record<string, ENTITY_STATE<PICK_ENTITY>>
  > = {};

  const emittingEvents = new Map<PICK_ENTITY, number>();
  const entityWatchers = new Map<PICK_ENTITY, Watcher[]>();

  let init = false;
  /**
   * Pretend like this has an `@OnEvent(HA_EVENT_STATE_CHANGE)` on it.
   * Socket service calls this separately from the event to ensure data is available here first.
   *
   * Leave as protected method to hide from editor auto complete
   */
  async function onEntityUpdate<ENTITY extends PICK_ENTITY = PICK_ENTITY>(
    entity_id: PICK_ENTITY,
    new_state: ENTITY_STATE<ENTITY>,
    old_state?: ENTITY_STATE<ENTITY>,
  ): Promise<void> {
    set(MASTER_STATE, entity_id, new_state);
    const value = emittingEvents.get(entity_id);
    if (value > EMPTY) {
      logger.error(
        `[%s] emitted an update before the previous finished processing`,
      );
      emittingEvents.set(entity_id, value + INCREMENT);
      return;
    }

    const list = entityWatchers.get(entity_id);
    if (is.empty(list)) {
      return;
    }
    await eachSeries(list, async watcher => {
      try {
        await watcher.callback(new_state, old_state);
      } catch (error) {
        logger.warn(
          { entity_id, error, new_state },
          `Entity update callback threw error`,
        );
      } finally {
        if (watcher.type === "once") {
          remove(entity_id, watcher.id);
        }
      }
    });
  }

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
        { defaultValue, name: entity },
        `[proxyGetLogic] cannot find entity {%s}`,
        property,
      );
    }
    return get(current, property, defaultValue);
  }

  /**
   * ... should it? Seems like a bad idea
   */
  function proxySetLogic<ENTITY extends PICK_ENTITY = PICK_ENTITY>(
    entity: ENTITY,
    property: string,
    value: unknown,
  ): boolean {
    logger.error(
      { name: entity, property, value },
      `Entity proxy does not accept value setting`,
    );
    return false;
  }

  function remove(entity_id: PICK_ENTITY, id: string): void {
    const current = entityWatchers.get(entity_id) ?? [];
    const filtered = current.filter(watcher => id !== watcher.id);
    if (is.empty(filtered)) {
      entityWatchers.delete(entity_id);
      return;
    }
    entityWatchers.set(entity_id, filtered);
  }

  /**
   * Retrieve an entity's state
   */
  function byId<ENTITY_ID extends PICK_ENTITY>(
    entity_id: ENTITY_ID,
  ): ENTITY_STATE<ENTITY_ID> {
    return get(MASTER_STATE, entity_id);
  }

  async function history<ENTITES extends PICK_ENTITY[]>(
    payload: Omit<EntityHistoryDTO<ENTITES>, "type">,
  ) {
    logger.trace(`Finding stuff`);
    const result = await hass.socket.sendMessage({
      ...payload,
      end_time: dayjs(payload.end_time).toISOString(),
      start_time: dayjs(payload.start_time).toISOString(),
      type: HASSIO_WS_COMMAND.history_during_period,
    });

    return Object.fromEntries(
      Object.keys(result).map(entity_id => {
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

  /**
   * Wait for this entity to change state.
   * Returns next state (however long it takes for that to happen)
   */
  async function nextState<ID extends PICK_ENTITY = PICK_ENTITY>(
    entity_id: ID,
  ): Promise<ENTITY_STATE<ID>> {
    return await new Promise<ENTITY_STATE<ID>>(done => {
      const current = entityWatchers.get(entity_id) ?? [];
      const item: Watcher = {
        callback: new_state => done(new_state as ENTITY_STATE<ID>),
        id: v4(),
        type: "once",
      };
      current.push(item);
      entityWatchers.set(entity_id, current);
    });
  }

  /**
   * Simple listing of all entity ids
   */
  function listEntities(): PICK_ENTITY[] {
    return Object.keys(MASTER_STATE).flatMap(domain =>
      Object.keys(MASTER_STATE[domain]).map(
        id => `${domain}.${id}` as PICK_ENTITY,
      ),
    );
  }
  /**
   * list all entities by domain
   */
  function findByDomain<DOMAIN extends ALL_DOMAINS = ALL_DOMAINS>(
    target: DOMAIN,
  ) {
    return Object.values(MASTER_STATE[target] ?? {}) as ENTITY_STATE<
      PICK_ENTITY<DOMAIN>
    >[];
  }

  function getEntities<
    T extends ENTITY_STATE<PICK_ENTITY> = ENTITY_STATE<PICK_ENTITY>,
  >(entityId: PICK_ENTITY[]): T[] {
    return entityId.map(id => byId(id) as T);
  }

  function createEntityProxy(entity: PICK_ENTITY) {
    return new Proxy({} as ENTITY_STATE<typeof entity>, {
      get: (_, property: string) => proxyGetLogic(entity, property),
      set: (_, property: string, value: unknown) =>
        proxySetLogic(entity, property, value),
    });
  }

  /**
   * Clear out the current state, and request a refresh.
   *
   * Refresh occurs through home assistant rest api, and is not bound by the websocket lifecycle
   */
  async function refresh(recursion = START): Promise<void> {
    const states = await hass.fetch.getAllEntities();
    if (is.empty(states)) {
      if (recursion > MAX_ATTEMPTS) {
        logger.fatal(
          `Failed to load service list from Home Assistant. Validate configuration`,
        );
        exit(FAILED);
      }
      logger.warn(
        "Failed to retrieve {entity} list. Retrying {%s}/[%s]",
        recursion,
        MAX_ATTEMPTS,
      );
      await sleep(FAILED_LOAD_DELAY * SECOND);
      await refresh(recursion + INCREMENT);
      return;
    }
    const oldState = MASTER_STATE;
    MASTER_STATE = {};

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
        logger.trace({ name: entity.entity_id }, ` no change on refresh`);
        return;
      }
      nextTick(async () => {
        await onEntityUpdate(entity.entity_id, entity);
      });
    });
    init = true;
  }

  /**
   * is id a valid entity?
   */
  function isEntity(entityId: PICK_ENTITY): entityId is PICK_ENTITY {
    return is.undefined(get(MASTER_STATE, entityId));
  }

  function OnUpdate<ENTITY extends PICK_ENTITY>(
    entity_id: ENTITY,
    callback: WatchFunction<ENTITY>,
  ) {
    const current = entityWatchers.get(entity_id) ?? [];
    entityWatchers.set(entity_id, [
      ...current,
      {
        callback: async (a, b) => await callback(a, b),
        id: v4(),
        type: "dynamic",
      },
    ]);
  }

  return {
    OnUpdate,
    byId,
    createEntityProxy,
    findByDomain,
    getEntities,
    history,
    isEntity,
    listEntities,
    nextState,
    refresh,
  };
}
