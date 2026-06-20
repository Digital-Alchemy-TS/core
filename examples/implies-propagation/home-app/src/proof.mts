/**
 * Type-only regression guard. NOT executed — only type-checked by `tsc`.
 *
 * The acceptance criterion this guards: a file that references NOTHING — it
 * imports neither the implier (LIVING_ROOM) nor the implied member (lighting) —
 * still sees `lighting` fully typed on `TServiceParams`. The app root
 * (main.mts) lists only LIVING_ROOM; the `implies`/`depends` augmentation is
 * program-global, so every file in the app gets the implied member's types with
 * zero registration and zero references. No import here is deliberate — adding
 * one to "make the types appear" would be proving a weaker thing than the AC.
 *
 * If the propagation regresses, this fails two ways:
 *   1. `lighting` disappears from `TServiceParams` -> the destructure below errors.
 *   2. `lighting` degrades to `any` -> the `@ts-expect-error` directives below
 *      become UNUSED, which is itself a compile error.
 */
import type { TServiceParams } from "@digital-alchemy/core";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _guard({ lighting }: TServiceParams) {
  // present AND correctly typed (brightness is a number)
  const level: number = lighting.Lights.brightness;
  void level;

  // @ts-expect-error brightness is a number, not a string — only catchable if genuinely typed
  const wrong: string = lighting.Lights.brightness;
  void wrong;

  // @ts-expect-error dim() takes a number, not a string — only catchable if genuinely typed
  lighting.Lights.dim("bright");

  // @ts-expect-error there is no `flicker` method — only catchable if genuinely typed
  lighting.Lights.flicker();
}
