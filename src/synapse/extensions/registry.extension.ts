import {
  InternalError,
  is,
  SECOND,
  TContext,
  TServiceParams,
  ZCC,
} from "../..";
import { ALL_DOMAINS } from "../../hass";

type BaseEntity = {
  name: string;
  icon?: string;
  unique_id?: string;
};

type SynapseSocketOptions<DATA extends object> = {
  context: TContext;
  domain: ALL_DOMAINS;
  details?: (data: DATA) => object;
};

const HEARTBEAT_INTERVAL = 5;

export function Registry({
  lifecycle,
  logger,
  hass,
  cache,
  config,
  context,
  scheduler,
}: TServiceParams) {
  lifecycle.onPostConfig(() => {
    if (!config.synapse.EMIT_HEARTBEAT) {
      return;
    }
    logger.trace(`Starting heartbeat`);
    scheduler.interval({
      context,
      exec: async () => await hass.socket.fireEvent("zcc_heartbeat"),
      interval: HEARTBEAT_INTERVAL * SECOND,
    });
  });

  return function <DATA extends BaseEntity>({
    domain,
    context,
    details,
  }: SynapseSocketOptions<DATA>) {
    logger.trace({ name: domain }, `init domain`);
    const registry = new Map<string, DATA>();
    let initComplete = false;

    hass.socket.onEvent({
      context: context,
      event: "zcc_reload_request",
      async exec() {
        logger.trace(`received reload request`);
        await SendEntityList();
      },
    });

    async function SendEntityList() {
      logger.debug(`send [%s] entity list`, domain);
      await hass.socket.fireEvent(`zcc_list_${domain}`, {
        [domain]: [...registry.entries()].map(([id, item]) => {
          return {
            ...(details ? details(item) : {}),
            icon: is.empty(item.icon) ? undefined : `mdi:${item.icon}`,
            id,
            name: item.name,
          };
        }),
      });
    }

    hass.socket.onConnect(async () => {
      await SendEntityList();
      initComplete = true;
    });

    const CACHE_KEY = (id: string) => `${domain}_cache:${id}`;

    return {
      add(data: DATA) {
        const id = is.empty(data.unique_id)
          ? is.hash(`${ZCC.application.name}:${data.name}`)
          : data.unique_id;
        if (registry.has(id)) {
          throw new InternalError(
            context,
            `ENTITY_COLLISION`,
            `${domain} registry already id`,
          );
        }
        registry.set(id, data);
        if (initComplete) {
          logger.warn(
            { context: context, name: domain },
            `late entity generation`,
          );
        }
        logger.debug({ name: data.name }, `register {%s}`, domain);
        return id;
      },
      byId(id: string) {
        return registry.get(id);
      },
      async getCache<T>(id: string, defaultValue?: T): Promise<T> {
        return await cache.get(CACHE_KEY(id), defaultValue);
      },
      async send(id: string, data: object) {
        if (!hass.socket.getConnectionActive()) {
          logger.debug(
            `socket connection isn't active, not sending update event`,
          );
          return;
        }
        await hass.socket.fireEvent(`zcc_event_${domain}`, { data, id });
      },
      async setCache(id: string, value: unknown) {
        await cache.set(CACHE_KEY(id), value);
      },
    };
  };
}
