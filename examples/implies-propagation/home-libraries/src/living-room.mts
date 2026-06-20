import { CreateLibrary, type TServiceParams } from "@digital-alchemy/core";

import { LIGHTING } from "./lighting.mjs";

/**
 * The "scenes" library. It `implies` LIGHTING — so anyone who loads LIVING_ROOM
 * gets LIGHTING pulled into membership automatically (no need to list it), and,
 * because LIGHTING's services are named functions, the implied member's *types*
 * ride along the import edge too.
 *
 * Note this file registers ONLY `living_room` on LoadedModules. It never
 * re-exports LIGHTING and never registers it on a side channel. The propagation
 * is entirely a consequence of capturing `implies` as a typed tuple.
 */
export function Scenes({ logger, lighting }: TServiceParams) {
  return {
    goodMorning() {
      logger.info("☀️  good morning");
      lighting.Lights.dim(80); // implied library, fully typed right here
    },
    goodNight() {
      logger.info("🌙 good night");
      lighting.Lights.dim(5);
    },
  };
}

export const LIVING_ROOM = CreateLibrary({
  name: "living_room",
  // `depends` = ordering: LIGHTING wires before us so `Scenes` can call it
  //   (params is a wire-time snapshot — a service only sees peers wired earlier).
  // `implies` = membership + types: a consumer that lists only LIVING_ROOM still
  //   gets LIGHTING wired AND fully typed, with no extra registration.
  depends: [LIGHTING],
  implies: [LIGHTING],
  services: { Scenes },
});

declare module "@digital-alchemy/core" {
  interface LoadedModules {
    living_room: typeof LIVING_ROOM;
  }
}
