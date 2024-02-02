import { InternalError, TServiceParams } from "@zcc/boilerplate";
import { INCREMENT, is, SECOND, sleep, START } from "@zcc/utilities";
import { exit } from "process";

import { LIB_HOME_ASSISTANT } from "../hass.module";
import {
  ALL_DOMAINS,
  HASSIO_WS_COMMAND,
  HassServiceDTO,
  PICK_SERVICE,
  PICK_SERVICE_PARAMETERS,
} from "../helpers/index";

let services: HassServiceDTO[];
let domains: string[];

type TCallProxy = Record<
  ALL_DOMAINS,
  Record<string, (...arguments_: unknown[]) => Promise<void>>
>;
const DEF_NOT_DOMAINS = new Set(["then", "constructor"]);
const FAILED_LOAD_DELAY = 5;
const MAX_ATTEMPTS = 50;
const FAILED = 1;

export function CallProxy({
  logger,
  lifecycle,
  context,
  getApis,
}: TServiceParams) {
  const hass = getApis(LIB_HOME_ASSISTANT);

  /**
   * Describe the current services, and build up a proxy api based on that.
   *
   * This API matches the api at the time the this function is run, which may be different from any generated typescript definitions from the past.
   */
  lifecycle.onBootstrap(async () => {
    if (!LIB_HOME_ASSISTANT.getConfig("CALL_PROXY_AUTO_SCAN")) {
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
      logger.error({ domain }, `unknown domain`);
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
    services = await hass.fetch.listServices();
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
      logger.info({ domain: value.domain }, `scanning`, value.domain);
      Object.entries(value.services).forEach(([serviceName]) =>
        logger.debug(` - {%s}`, serviceName),
      );
    });
  }

  /**
   * Prefer sending via socket, if available.
   */
  async function sendMessage<SERVICE extends PICK_SERVICE>(
    serviceName: SERVICE,
    service_data: PICK_SERVICE_PARAMETERS<SERVICE>,
  ) {
    if (!hass.socket.getConnectionActive()) {
      return await hass.fetch.callService(serviceName, service_data);
    }
    const [domain, service] = serviceName.split(".");
    // User can just not await this call if they don't care about the "waitForChange"

    return await hass.socket.sendMessage(
      {
        domain,
        service,
        service_data,
        type: HASSIO_WS_COMMAND.call_service,
      },
      true,
    );
  }

  function buildCallProxy(): TCallProxy {
    return new Proxy(
      {},
      { get: (_, domain: ALL_DOMAINS) => getDomain(domain) },
    );
  }

  return buildCallProxy();
}
