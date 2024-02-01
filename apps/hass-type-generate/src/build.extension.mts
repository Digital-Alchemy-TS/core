import { TServiceParams } from "@zcc/boilerplate";
import { LIB_HOME_ASSISTANT } from "@zcc/home-assistant";

import { HASS_TYPE_GENERATE } from "./main.mjs";

export function BuildTypes({ logger, lifecycle, getApis }: TServiceParams) {
  let targetFile: string;
  const hass = getApis(LIB_HOME_ASSISTANT);
  const app = getApis(HASS_TYPE_GENERATE);

  lifecycle.onPostConfig(() => {
    targetFile = HASS_TYPE_GENERATE.getConfig("TARGET_FILE");
    logger.info({ targetFile });
  });

  lifecycle.onReady(async () => {
    //
  });

  async function DoBuild() {
    logger.info(`Pulling information`);
    const typeInterface = await app.typeWriter();
    const entities = await hass.fetch.getAllEntities();
    return [
      `// This file is generated, and is automatically updated as a npm post install step`,
      "// To rebuild, run `npx hass-type-generate`",
      ``,
      `import { PICK_ENTITY } from "./types/index.mjs";`,
      ``,
      `export const ENTITY_SETUP = ${entities};`,
      "/** Use with `@InjectCallProxy()` */",
      typeInterface,
      "",
    ].join(`\n`);
  }
}
