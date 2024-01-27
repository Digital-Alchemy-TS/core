import { TServiceParams } from "@zcc/boilerplate";

export function Button({ logger }: TServiceParams) {
  function onPress(button: string) {
    logger.trace({ button }, `onPress`);
  }
  return { onPress };
}
