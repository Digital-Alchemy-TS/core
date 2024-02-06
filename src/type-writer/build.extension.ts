import { existsSync, writeFileSync } from "fs";
import { set } from "object-path";
import { join } from "path";

import { TServiceParams } from "../boilerplate";
import { is } from "../utilities";

export function BuildTypes({
  logger,
  lifecycle,
  hass,
  type_writer,
  config,
}: TServiceParams) {
  // ? join(__dirname, "..", "home-assistant", "src", "dynamic.d.ts")
  lifecycle.onReady(async () => {
    try {
      const path = is.empty(config.type_writer.TARGET_FILE)
        ? join(__dirname, "..", "hass", "dynamic.d.ts")
        : config.type_writer.TARGET_FILE;
      if (!existsSync(path)) {
        if (config.type_writer.TARGET_FILE !== path) {
          // Represents an error with the script
          // Calculated the wrong path, and something is up
          logger.fatal({ path }, `cannot locate target file, aborting`);
          return;
        }
        logger.warn({ path }, `creating new type definitions file`);
      }
      const text = await DoBuild();
      writeFileSync(path, text);
      logger.info(`successfully wrote hass type definitions file`);
    } catch (error) {
      console.error(error);
      logger.fatal({ error }, `failed to write type definitions file`);
    }
  });

  // see file - libs/home-assistant/src/dynamic.ts
  async function DoBuild() {
    logger.info(`Pulling information`);
    // console.log({ hass, type_writer });
    const typeInterface = await type_writer.typeWriter();
    const entities = await hass.fetch.getAllEntities();
    const entitySetup = {};
    entities.forEach(i => set(entitySetup, i.entity_id, i));
    return [
      `// This file is generated, and is automatically updated as a npm post install step`,
      "// Do not edit this file, it will only affect type definitions, not functional code",
      "",
      `import { PICK_ENTITY } from "./helpers";`,
      "",
      `export const ENTITY_SETUP = ${JSON.stringify(entitySetup, undefined, "  ")};`,
      "",
      typeInterface,
      "",
    ].join(`\n`);
  }
}