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
const BOOT_TIME = new Date().toISOString();

export function Registry({
  lifecycle,
  logger,
  hass,
  cache,
  config,
  context,
  scheduler,
}: TServiceParams) {
  // # Common
  const LOADERS = new Map<ALL_DOMAINS, () => object[]>();
  let initComplete = false;
  const HEARTBEAT = `zcc_heartbeat_${ZCC.application.name}`;

  async function SendEntityList() {
    logger.debug(`send entity list`);
    const domains = Object.fromEntries(
      [...LOADERS.keys()].map(domain => {
        const data = LOADERS.get(domain)();
        return [domain, data];
      }),
    );
    const hash = is.hash(JSON.stringify(domains));
    await hass.socket.fireEvent(`zcc_application_state`, {
      app: ZCC.application.name,
      boot: BOOT_TIME,
      domains,
      hash,
    });
  }

  // ## Heartbeat
  lifecycle.onPostConfig(async () => {
    if (!config.synapse.EMIT_HEARTBEAT) {
      return;
    }
    logger.trace(`starting heartbeat`);
    scheduler.interval({
      context,
      exec: async () => await hass.socket.fireEvent(HEARTBEAT),
      interval: HEARTBEAT_INTERVAL * SECOND,
    });
  });

  // ## Different opportunities to announce
  // ### At boot
  hass.socket.onConnect(async () => {
    initComplete = true;
    await hass.socket.fireEvent(HEARTBEAT);
    if (!config.synapse.ANNOUNCE_AT_CONNECT) {
      return;
    }
    logger.debug(`[socket connect] sending entity list`);
    await SendEntityList();
  });

  // ### Targeted at this app
  hass.socket.onEvent({
    context,
    event: "zcc_app_reload",
    exec: async ({ app }: { app: string }) => {
      if (app !== ZCC.application.name) {
        return;
      }
      logger.info(`zcc.reload(%s)`, app);
      await SendEntityList();
    },
  });

  // ### Targeted at all zcc apps
  hass.socket.onEvent({
    context,
    event: "zcc_app_reload_all",
    exec: async () => {
      logger.info({ all: true }, `zcc.reload()`);
      await SendEntityList();
    },
  });

  // # Domain registry
  return function <DATA extends BaseEntity>({
    domain,
    context,
    details,
  }: SynapseSocketOptions<DATA>) {
    logger.trace({ name: domain }, `init domain`);
    const registry = new Map<string, DATA>();
    const CACHE_KEY = (id: string) => `${domain}_cache:${id}`;

    // ## Export the data for hass
    LOADERS.set(domain, () => {
      return [...registry.entries()].map(([id, item]) => {
        return {
          ...(details ? details(item) : {}),
          icon: is.empty(item.icon) ? undefined : `mdi:${item.icon}`,
          id,
          name: item.name,
        };
      });
    });

    // ## Registry interactions
    return {
      // ### Add
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
      // ### byId
      byId(id: string) {
        return registry.get(id);
      },
      // ### getCache
      async getCache<T>(id: string, defaultValue?: T): Promise<T> {
        return await cache.get(CACHE_KEY(id), defaultValue);
      },
      // ### send
      async send(id: string, data: object) {
        if (!hass.socket.getConnectionActive()) {
          logger.debug(
            `socket connection isn't active, not sending update event`,
          );
          return;
        }
        await hass.socket.fireEvent(`zcc_event`, { data, id });
      },
      // ### setCache
      async setCache(id: string, value: unknown) {
        await cache.set(CACHE_KEY(id), value);
      },
    };
  };
}
