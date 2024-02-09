import { writeFileSync } from "fs";
import { join } from "path";

import { is, TServiceParams, ZCC } from "../..";

/**
 * For use with type-writer. Not imported as synapse
 *
 * Refine types internal for this library
 */
export function IconGeneratorExtension({ logger }: TServiceParams) {
  return async function () {
    logger.info(`Looking up [MaterialDesign] icons`);
    const list = await ZCC.fetch<IconData[]>({
      rawUrl: true,
      url: `https://raw.githubusercontent.com/Templarian/MaterialDesign/master/meta.json`,
    });
    logger.debug(`Received %s icons`, list.length);
    const ICON_DATA = {} as Record<string, string[]>;
    list.forEach(item => {
      ICON_DATA[item.name] = item.tags || [];
    });
    logger.debug({ tags: is.unique(Object.values(ICON_DATA).flat()) });
    const iconData = `export type string = ${Object.keys(ICON_DATA)
      .map(i => `"${i}"`)
      .join(" |\n ")}\n`;
    const target = join(__dirname, "..", "helpers", "icon.helper.d.ts");
    writeFileSync(target, iconData);
  };
}

interface IconData {
  id: string;
  baseIconId: string;
  name: string;
  codepoint: string;
  aliases: string[];
  styles: string[];
  version: string;
  deprecated: boolean;
  tags: string[];
  author: string;
}
