/* eslint-disable @typescript-eslint/no-magic-numbers */
import { env, exit } from "process";

import { is, TServiceParams, ZCC } from "../..";
import { PostConfigPriorities } from "..";
export function Configure({
  logger,
  lifecycle,
  hass,
  config,
  internal,
}: TServiceParams) {
  /**
   * Check for environment defined tokens provided by Home Assistant
   *
   * If available, override defaults to match
   */
  lifecycle.onPreInit(() => {
    const token = env.HASSIO_TOKEN || env.SUPERVISOR_TOKEN;
    if (is.empty(token)) {
      return;
    }
    logger.debug(`auto configuring from addon environment`);
    internal.config.set(
      "hass",
      "BASE_URL",
      env.HASS_SERVER || "http://supervisor/core",
    );
    internal.config.set("hass", "TOKEN", token);
  });

  /**
   * Request by someone to validate the provided credentials are valid
   *
   * Send a test request, and provide feedback on what happened
   */
  lifecycle.onPostConfig(async () => {
    if (!config.hass.VALIDATE_CONFIGURATION) {
      return;
    }
    ZCC.logger.setLogLevel("trace");
    logger.info(`validating credentials`);
    try {
      const result = await hass.fetch.checkCredentials();
      if (is.object(result)) {
        // * all good
        logger.info(result.message);
        exit(1);
      }
      // * bad token
      logger.error(String(result));
      exit(0);
    } catch (error) {
      // * bad BASE_URL
      logger.error({ error }, "failed to send request");
      exit(0);
    }
  }, PostConfigPriorities.VALIDATE);
}
