/**
 * Type-only regression guard. NOT executed — only type-checked by `tsc`.
 *
 * This is the durable part of the artifact. If a future TypeScript version stops
 * carrying an implied library's `declare module` augmentation through the
 * `implies` import edge, one of two things happens and `tsc` fails either way:
 *
 *   1. `lighting` disappears from `TServiceParams` -> the destructure below errors.
 *   2. `lighting` degrades to `any` -> the `@ts-expect-error` directives below
 *      become UNUSED, which is itself a compile error.
 *
 * Importing only the implier (LIVING_ROOM) is deliberate — `lighting` is never
 * imported here.
 */
import type { TServiceParams } from "@digital-alchemy/core";
import { LIVING_ROOM } from "@demo/home-libraries/living-room";

void LIVING_ROOM;

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
