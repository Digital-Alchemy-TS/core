import { CreateLibrary, type TServiceParams } from "@digital-alchemy/core";

/**
 * A plain library. Nothing special — except that its service is a LITERAL
 * named `function` declaration.
 *
 * That detail is load-bearing: when another library lists `LIGHTING` in its
 * `implies`, TypeScript emits `typeof import("./lighting.mjs").Lights` into the
 * implier's `.d.ts`. That import is a real module edge, and it is what carries
 * this `declare module` augmentation downstream. An inline arrow service
 * (`Lights: () => ({...})`) would be inlined anonymously with no edge, and the
 * types below would NOT travel through `implies`.
 */
export function Lights({ logger }: TServiceParams) {
  let brightness = 0;
  return {
    dim(toPercent: number) {
      brightness = toPercent;
      logger.info(`💡 lights → ${toPercent}%`);
    },
    get brightness() {
      return brightness;
    },
  };
}

export const LIGHTING = CreateLibrary({
  name: "lighting",
  services: { Lights },
});

declare module "@digital-alchemy/core" {
  interface LoadedModules {
    lighting: typeof LIGHTING;
  }
}
