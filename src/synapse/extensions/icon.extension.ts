import { writeFileSync } from "fs";
import { join } from "path";

import { TServiceParams, ZCC } from "../..";

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
    const tags = new Set<string>();
    const ICON_DATA = Object.fromEntries(
      list.map(i => {
        i.tag.forEach(tag => tags.add(tag));
        return [i.name, i.tag];
      }),
    );
    logger.debug({ tags: [...tags.values()] });
    const iconData = `export const ICON_DATA = ${JSON.stringify(ICON_DATA, undefined, "  ")} as const;\n`;
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
  tag: string[];
  author: string;
}
