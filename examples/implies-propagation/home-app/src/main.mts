/**
 * Downstream app. The whole point of this file:
 *
 *   - It imports ONLY `LIVING_ROOM`.
 *   - It lists ONLY `LIVING_ROOM` in `libraries`.
 *   - It never imports, names, or registers `lighting` anywhere.
 *
 * Yet `params.lighting` is fully typed AND wired at runtime — it arrived purely
 * through `LIVING_ROOM`'s `implies`. Membership comes along (runtime), and the
 * types come along (compile time), with zero extra wiring.
 */
import { CreateApplication, type TServiceParams } from "@digital-alchemy/core";
import { LIVING_ROOM } from "@demo/home-libraries/living-room";

function Routine({ living_room, lighting, lifecycle, logger }: TServiceParams) {
  lifecycle.onReady(() => {
    logger.info("— a day in the (imaginary) living room —");
    living_room.Scenes.goodMorning();

    // `lighting` was never imported or listed here. It is implied by LIVING_ROOM.
    // It is typed (try `lighting.Lights.dim("bright")` — it won't compile) and live.
    logger.info(`lighting reports ${lighting.Lights.brightness}% — typed, no registration`);

    living_room.Scenes.goodNight();
    logger.info(`...and down to ${lighting.Lights.brightness}%`);
  });
}

const HOME = CreateApplication({
  name: "home",
  libraries: [LIVING_ROOM], // only the top library; `lighting` is implied
  services: { Routine },
});

declare module "@digital-alchemy/core" {
  interface LoadedModules {
    home: typeof HOME;
  }
}

await HOME.bootstrap();
await HOME.teardown();
