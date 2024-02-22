import { exit } from "process";

import {
  DOWN,
  eachLimit,
  is,
  SECOND,
  sleep,
  START,
  TServiceParams,
  UP,
} from "..";
import { PICK_ENTITY } from "../hass";

export function Purge({ hass, logger, config }: TServiceParams) {
  hass.socket.onConnect(async () => {
    const data = (await hass.socket.sendMessage({
      type: "config/entity_registry/list",
    })) as { platform: string; entity_id: PICK_ENTITY }[];
    if (config.purge.LIST_PLATFORMS) {
      const platforms = is.unique(data.map(({ platform }) => platform));
      logger.info({ platforms }, `platform list`);
      exit();
    }
    if (is.empty(config.purge.PLATFORM)) {
      logger.error(`define [purge.PLATFORM] to pick a platform to remove`);
      exit();
    }
    logger.info({ platform: config.purge.PLATFORM }, `looking up entities`);

    const filtered = data
      .filter(
        i =>
          i.platform === config.purge.PLATFORM &&
          !config.purge.EXCLUDE_ENTITIES.includes(i.entity_id),
      )
      .map(({ entity_id }) => entity_id);

    const currentlyExists = filtered.filter(
      i => hass.entity.byId(i).state !== "unavailable",
    );
    if (!is.empty(currentlyExists)) {
      logger.error(
        { entities: currentlyExists, platform: config.purge.PLATFORM },
        `cannot purge entities, still online`,
      );
      return;
    }

    logger.warn(
      {
        entities: filtered.sort((a, b) => (a > b ? UP : DOWN)),
      },
      `[purge] is getting ready to remove the following entities from Home Assistant`,
    );
    logger.warn("press [ctrl-c] before timer stops to cancel");
    for (let i = START; i < config.purge.CANCEL_TIMEOUT; i++) {
      logger.warn(`removing in {%s}`, config.purge.CANCEL_TIMEOUT - i);
      await sleep(SECOND);
    }

    await eachLimit(filtered, config.purge.PURGE_RATE, async entity_id => {
      await hass.socket.sendMessage({
        entity_id,
        type: "config/entity_registry/remove",
      });
    });

    logger.info(`removed [%s] entities successfully`, filtered.length);
    exit();
  });
}
