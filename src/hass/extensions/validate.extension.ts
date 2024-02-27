/* eslint-disable @typescript-eslint/no-magic-numbers */
import { exit } from "process";

import { is, TServiceParams, ZCC } from "../..";
import { PostConfigPriorities } from "..";

export function Validate({ logger, lifecycle, hass, config }: TServiceParams) {
  lifecycle.onPostConfig(async () => {
    if (!config.hass.VALIDATE_CONFIGURATION) {
      return;
    }
    ZCC.logger.setLogLevel("trace");
    logger.info(`validating credentials`);
    try {
      const result = await hass.fetch.checkCredentials();
      if (is.object(result)) {
        logger.info(result.message);
        exit(1);
      }
      logger.error(String(result));
      exit(0);
    } catch (error) {
      logger.error({ error }, "failed to send request");
      exit(0);
    }
  }, PostConfigPriorities.VALIDATE);
}
