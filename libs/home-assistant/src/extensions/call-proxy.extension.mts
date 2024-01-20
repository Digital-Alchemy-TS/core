import { InternalError, TServiceParams } from "@zcc/boilerplate";
import { INCREMENT, is, SECOND, sleep, START, ZCC } from "@zcc/utilities";
import { nextTick } from "async";
import { exit } from "process";

import {
  CALL_PROXY_PROXY_COMMAND,
  CallProxyCommandData,
  PROXY_SERVICE_LIST_UPDATED,
} from "../helpers/dynamic.helper.mjs";
import { HASSIO_WS_COMMAND } from "../helpers/types/constants.helper.mjs";
import { HassServiceDTO } from "../helpers/types/fetch/service-list.mjs";
import {
  ALL_DOMAINS,
  PICK_SERVICE,
  PICK_SERVICE_PARAMETERS,
} from "../helpers/types/utility.helper.mjs";

let services: HassServiceDTO[];
let domains: string[];

type CallProxy = Record<
  ALL_DOMAINS,
  Record<string, (...arguments_) => Promise<void>>
>;
const DEF_NOT_DOMAINS = new Set(["then", "constructor"]);
const FAILED_LOAD_DELAY = 5;
const MAX_ATTEMPTS = 50;
const FAILED = 1;

export function HACallProxy({
  logger,
  lifecycle,
  context,
  getConfig,
}: TServiceParams) {
  /**
   * Describe the current services, and build up a proxy api based on that.
   *
   * This API matches the api at the time the this function is run, which may be different from any generated typescript definitions from the past.
   */
  lifecycle.onBootstrap(async () => {
    if (!getConfig<boolean>(CALL_PROXY_PROXY_COMMAND)) {
      return;
    }
    logger.debug(`Runtime populate service interfaces`);
    await loadServiceList();
  });

  function getDomain(domain: ALL_DOMAINS) {
    if (DEF_NOT_DOMAINS.has(domain)) {
      return undefined;
    }
    if (!domains || !domains?.includes(domain)) {
      logger.error(`[%s] unknown domain`, domain);
      return undefined;
    }
    const domainItem: HassServiceDTO = services.find(i => i.domain === domain);
    if (!domainItem) {
      throw new InternalError(
        context,
        "HALLUCINATED_DOMAIN",
        `Cannot access call_service#${domain}. Home Assistant doesn't list it as a real domain.`,
      );
    }
    return Object.fromEntries(
      Object.entries(domainItem.services).map(([key]) => [
        key,
        async (parameters: object) =>
          await sendMessage(`${domain}.${key}`, { ...parameters }),
      ]),
    );
  }

  async function loadServiceList(recursion = START): Promise<void> {
    logger.info(`Fetching service list`);
    services = await ZCC.hass.fetch.listServices();
    if (is.empty(services)) {
      if (recursion > MAX_ATTEMPTS) {
        logger.fatal(
          `Failed to load service list from Home Assistant. Validate configuration`,
        );
        exit(FAILED);
      }
      logger.warn(
        "Failed to retrieve {service} list. Retrying {%s}/[%s]",
        recursion,
        MAX_ATTEMPTS,
      );
      await sleep(FAILED_LOAD_DELAY * SECOND);
      await loadServiceList(recursion + INCREMENT);
      return;
    }
    domains = services.map(i => i.domain);
    services.forEach(value => {
      logger.info(`[%s] scanning`, value.domain);
      Object.entries(value.services).forEach(([serviceName]) =>
        logger.debug(` - {%s}`, serviceName),
      );
    });
    ZCC.event.emit(PROXY_SERVICE_LIST_UPDATED);
  }

  /**
   * Prefer sending via socket, if available.
   */
  async function sendMessage<SERVICE extends PICK_SERVICE>(
    serviceName: SERVICE,
    service_data: PICK_SERVICE_PARAMETERS<SERVICE>,
  ) {
    if (!ZCC.hass.socket.getConnectionActive()) {
      return await ZCC.hass.fetch.callService(serviceName, service_data);
    }
    const [domain, service] = serviceName.split(".");
    // User can just not await this call if they don't care about the "waitForChange"
    ZCC.event.emit(CALL_PROXY_PROXY_COMMAND, {
      domain,
      service,
    } as CallProxyCommandData);
    return await ZCC.hass.socket.sendMessage(
      {
        domain,
        service,
        service_data,
        type: HASSIO_WS_COMMAND.call_service,
      },
      true,
    );
  }

  function buildCallProxy(): CallProxy {
    return new Proxy(
      {},
      { get: (_, domain: ALL_DOMAINS) => getDomain(domain) },
    );
  }

  const out = buildCallProxy();
  ZCC.hass.call = out;
  return buildCallProxy;
}

export type THACallProxy = CallProxy;
