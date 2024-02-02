import { TServiceParams } from "@zcc/boilerplate";
import { HALF, SECOND, sleep } from "@zcc/utilities";

import {
  BackupResponse,
  HASSIO_WS_COMMAND,
  HomeAssistantBackup,
} from "../helpers/index";
import { LIB_HOME_ASSISTANT } from "../hass.module";

export function Utilities({ logger, getApis }: TServiceParams) {
  const hass = getApis(LIB_HOME_ASSISTANT);

  async function generate(): Promise<HomeAssistantBackup> {
    let current = await list();
    // const originalLength = current.backups.length;
    if (current.backing_up) {
      logger.warn(
        `A backup is currently in progress. Waiting for that to complete instead.`,
      );
    } else {
      logger.info("Initiating new backup");
      hass.socket.sendMessage({
        type: HASSIO_WS_COMMAND.generate_backup,
      });
      while (current.backing_up === false) {
        logger.debug("... waiting");
        await sleep(HALF * SECOND);
        current = await list();
      }
    }
    while (current.backing_up === true) {
      logger.debug("... waiting");
      await sleep(HALF * SECOND);
      current = await list();
    }
    logger.info(`Backup complete`);
    return current.backups.pop();
  }

  async function list(): Promise<BackupResponse> {
    return await hass.socket.sendMessage<BackupResponse>({
      type: HASSIO_WS_COMMAND.backup_info,
    });
  }

  async function remove(slug: string): Promise<void> {
    await hass.socket.sendMessage(
      { slug, type: HASSIO_WS_COMMAND.remove_backup },
      false,
    );
  }

  return { generate, list, remove };
}
