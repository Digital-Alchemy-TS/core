import { TServiceParams } from "@zcc/boilerplate";
import { HALF, SECOND, sleep, ZCC } from "@zcc/utilities";

import { HASS_ONBACKUP, HassOnBackupData } from "../helpers/dynamic.helper.mjs";
import {
  BackupResponse,
  HomeAssistantBackup,
} from "../helpers/types/backup.helper.mjs";
import { HASSIO_WS_COMMAND } from "../helpers/types/constants.helper.mjs";

export function HAUtilities({ logger }: TServiceParams) {
  async function generate(): Promise<HomeAssistantBackup> {
    let current = await list();
    // const originalLength = current.backups.length;
    let start: number;
    if (current.backing_up) {
      logger.warn(
        `A backup is currently in progress. Waiting for that to complete instead.`,
      );
    } else {
      start = Date.now();
      logger.info("Initiating new backup");
      ZCC.hass.socket.sendMessage({
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
    if (start) {
      ZCC.event.emit(HASS_ONBACKUP, {
        time: Date.now() - start,
      } as HassOnBackupData);
    }
    logger.info(`Backup complete`);
    return current.backups.pop();
  }

  async function list(): Promise<BackupResponse> {
    return await ZCC.hass.socket.sendMessage<BackupResponse>({
      type: HASSIO_WS_COMMAND.backup_info,
    });
  }

  async function remove(slug: string): Promise<void> {
    await ZCC.hass.socket.sendMessage(
      { slug, type: HASSIO_WS_COMMAND.remove_backup },
      false,
    );
  }

  const out = { generate, list, remove } as THAUtils;
  ZCC.hass.utils = out;
  return out;
}

export type THAUtils = {
  generate(): Promise<HomeAssistantBackup>;
  list(): Promise<BackupResponse>;
  remove(slug: string): Promise<void>;
};
