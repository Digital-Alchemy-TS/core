/**
 * In-suite compile-time proof: cross-package type-travel via `implies` / `depends`
 *
 * This file tests four invariants of the named-function-declaration edge mechanism
 * that was extended to `depends` in commit 2a3006c.  Every type-level assertion is
 * evaluated at compile time by the suite's tsconfig (`tsc --noEmit`); the runtime
 * `it()` blocks give vitest something to count and serve as documentation anchors.
 *
 * ─── Mechanism under proof ───────────────────────────────────────────────────
 * A service written as a named `function` declaration emits a
 * `typeof import("./x").Svc` edge in the `.d.ts`, which activates the source
 * file's `declare module "@digital-alchemy/core" { interface LoadedModules }`
 * augmentation in every downstream consumer.  `CreateLibrary` captures its
 * `implies` and `depends` arrays as literal `const` tuple type parameters, so
 * the emitted `.d.ts` for the wrapping library references each element by name —
 * preserving the import-edge chain across package boundaries.
 *
 * `TServiceParams` merges contributions with priority:
 *   direct `LoadedModules` wins over `Omit<RollupApis, keyof LoadedModules>`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { GetApis, LoadedModules, TServiceParams } from "../src/index.mts";
import { CreateLibrary } from "../src/index.mts";

// ─── Type-assertion helpers (local; the originals in wiring.mts are unexported) ─

// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- 1/2 are canonical sentinels for type-equality
type TypeEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type ExpectTrue<T extends true> = T;

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 1 FIXTURES
//
// Simulate the cross-package pattern:
//   LIB_TRAVEL_BASE  — service is a NAMED function declaration; augments LoadedModules.
//   LIB_TRAVEL_ROOT  — depends on LIB_TRAVEL_BASE; its `depends` tuple carries the edge.
//
// In a real cross-package deploy, the `.d.ts` import edge on the captured tuple
// is what delivers the LoadedModules augmentation to a downstream consumer that
// never directly imported LIB_TRAVEL_BASE.  In-suite, declaring the augmentation
// here is the equivalent end-state — the type assertions below prove it integrates
// correctly with TServiceParams.
// ═══════════════════════════════════════════════════════════════════════════════

export function TravelBaseService() {
  return {
    greet(): string {
      return "hello";
    },
    count: 42 as number,
  };
}

export const LIB_TRAVEL_BASE = CreateLibrary({
  name: "travel_base" as "travel_base",
  services: { TravelBaseService },
});

export function TravelRootService() {
  return { alive: true as boolean };
}

export const LIB_TRAVEL_ROOT = CreateLibrary({
  depends: [LIB_TRAVEL_BASE],
  name: "travel_root" as "travel_root",
  services: { TravelRootService },
});

declare module "@digital-alchemy/core" {
  interface LoadedModules {
    travel_base: typeof LIB_TRAVEL_BASE;
    travel_root: typeof LIB_TRAVEL_ROOT;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 2 FIXTURES
//
// Register "priority_direct" in BOTH LoadedModules (direct channel) and
// LoadedRollups (hoisted fallback channel) with DELIBERATELY DIFFERENT shapes.
//
// TServiceParams is built as:
//   GlobalParams & { [K in ExternalLoadedModules]: GetApis<LoadedModules[K]> }
//               & Omit<RollupApis, keyof LoadedModules>
//
// The Omit<RollupApis, keyof LoadedModules> strips the rollup shape when the same
// key is directly known.  We prove this by asserting the direct shape wins and
// the divergent `HoistedService` key is absent.
// ═══════════════════════════════════════════════════════════════════════════════

export function PriorityDirectService() {
  return { value: "direct" as string };
}

export const LIB_PRIORITY_DIRECT = CreateLibrary({
  name: "priority_direct" as "priority_direct",
  services: { PriorityDirectService },
});

declare module "@digital-alchemy/core" {
  interface LoadedModules {
    priority_direct: typeof LIB_PRIORITY_DIRECT;
  }
  // Deliberately divergent shape on the hoisted channel — same key, different
  // service structure.  If the Omit guard broke, HoistedService would appear on
  // TServiceParams["priority_direct"] and the negative assertion below would fail.
  interface LoadedRollups {
    rollup_priority_divergent: {
      priority_direct: {
        HoistedService: { value: 999 };
      };
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 3 FIXTURES
//
// NEGATIVE CONTROL: deliberately omit the LoadedModules augmentation for a
// library whose service is an arrow/const.  In a cross-package scenario, a
// const/arrow service produces no named import edge in the `.d.ts`, so the
// augmentation never reaches the consumer.  We model that here by simply not
// augmenting LoadedModules, then asserting via @ts-expect-error that the key
// is absent from TServiceParams.
// ═══════════════════════════════════════════════════════════════════════════════

// Arrow service — structurally inlined in .d.ts, no named import edge.
const ConstArrowService = (): { hidden: boolean } => ({ hidden: true });

export const LIB_CONST_ARROW = CreateLibrary({
  // @ts-expect-error — "const_arrow" is intentionally absent from LoadedModules
  name: "const_arrow",
  services: { ConstArrowService },
});

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 4 FIXTURES
//
// FAN-OUT SANITY: one base library depended-on by many others.
// Proves no TS2456 (circular reference), no emit errors, and all types resolve
// correctly at real `depends` density (the unproven risk from commit 2a3006c).
// ═══════════════════════════════════════════════════════════════════════════════

export function FanOutBaseService() {
  return { ping: (): string => "pong" };
}
export const LIB_FANOUT_BASE = CreateLibrary({
  name: "fanout_base" as "fanout_base",
  services: { FanOutBaseService },
});

export function FanOutConsumerAService() {
  return { a: true as boolean };
}
export const LIB_FANOUT_A = CreateLibrary({
  depends: [LIB_FANOUT_BASE],
  name: "fanout_a" as "fanout_a",
  services: { FanOutConsumerAService },
});

export function FanOutConsumerBService() {
  return { b: true as boolean };
}
export const LIB_FANOUT_B = CreateLibrary({
  depends: [LIB_FANOUT_BASE],
  name: "fanout_b" as "fanout_b",
  services: { FanOutConsumerBService },
});

export function FanOutConsumerCService() {
  return { c: true as boolean };
}
export const LIB_FANOUT_C = CreateLibrary({
  depends: [LIB_FANOUT_BASE],
  name: "fanout_c" as "fanout_c",
  services: { FanOutConsumerCService },
});

export function FanOutConsumerDService() {
  return { d: true as boolean };
}
export const LIB_FANOUT_D = CreateLibrary({
  depends: [LIB_FANOUT_BASE],
  name: "fanout_d" as "fanout_d",
  services: { FanOutConsumerDService },
});

export function FanOutConsumerEService() {
  return { e: true as boolean };
}
export const LIB_FANOUT_E = CreateLibrary({
  depends: [LIB_FANOUT_BASE, LIB_FANOUT_A, LIB_FANOUT_B, LIB_FANOUT_C, LIB_FANOUT_D],
  name: "fanout_e" as "fanout_e",
  services: { FanOutConsumerEService },
});

declare module "@digital-alchemy/core" {
  interface LoadedModules {
    fanout_base: typeof LIB_FANOUT_BASE;
    fanout_a: typeof LIB_FANOUT_A;
    fanout_b: typeof LIB_FANOUT_B;
    fanout_c: typeof LIB_FANOUT_C;
    fanout_d: typeof LIB_FANOUT_D;
    fanout_e: typeof LIB_FANOUT_E;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPILE-TIME ASSERTIONS
//
// Each exported type alias fails tsc with "Type 'false' does not satisfy the
// constraint 'true'" if the proven invariant regresses.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Case 1 ────────────────────────────────────────────────────────────────────

/** travel_base is present on TServiceParams with the correct GetApis shape. */
export type _Assert_Case1_TravelBasePresent = ExpectTrue<
  TypeEqual<TServiceParams["travel_base"], GetApis<LoadedModules["travel_base"]>>
>;

/** The `count` property on TravelBaseService is typed as `number`. */
export type _Assert_Case1_CountIsNumber = ExpectTrue<
  TypeEqual<TServiceParams["travel_base"]["TravelBaseService"]["count"], number>
>;

/** travel_root is present on TServiceParams (depends chain). */
export type _Assert_Case1_TravelRootPresent = ExpectTrue<
  TypeEqual<TServiceParams["travel_root"], GetApis<LoadedModules["travel_root"]>>
>;

// ── Case 2 ────────────────────────────────────────────────────────────────────

/**
 * `priority_direct` resolves to the LoadedModules shape, not the LoadedRollups
 * divergent shape.
 */
export type _Assert_Case2_DirectBeatsHoisted = ExpectTrue<
  TypeEqual<TServiceParams["priority_direct"], GetApis<LoadedModules["priority_direct"]>>
>;

/**
 * The divergent `HoistedService` key from LoadedRollups must NOT be present.
 * If the Omit guard broke, this @ts-expect-error would become an unused-directive
 * error and tsc would fail.
 */
// @ts-expect-error — HoistedService must not bleed from LoadedRollups when LoadedModules owns the key
export type _Assert_Case2_HoistedAbsent = TServiceParams["priority_direct"]["HoistedService"];

// ── Case 3 ────────────────────────────────────────────────────────────────────

/**
 * `const_arrow` is NOT in LoadedModules; TServiceParams must not expose it.
 * If the key were somehow present the @ts-expect-error below becomes unused →
 * compile error → suite goes red.
 */
// @ts-expect-error — const_arrow is absent from LoadedModules; must be absent from TServiceParams
export type _Assert_Case3_ConstArrowAbsent = TServiceParams["const_arrow"];

// ── Case 4 ────────────────────────────────────────────────────────────────────

/** FanOutBaseService.ping is typed as () => string. */
export type _Assert_Case4_FanOutBasePing = ExpectTrue<
  TypeEqual<TServiceParams["fanout_base"]["FanOutBaseService"]["ping"], () => string>
>;

/** All four sibling consumer services are typed. */
export type _Assert_Case4_AllSiblingsPresent = ExpectTrue<
  TypeEqual<TServiceParams["fanout_a"]["FanOutConsumerAService"]["a"], boolean> &
    TypeEqual<TServiceParams["fanout_b"]["FanOutConsumerBService"]["b"], boolean> &
    TypeEqual<TServiceParams["fanout_c"]["FanOutConsumerCService"]["c"], boolean> &
    TypeEqual<TServiceParams["fanout_d"]["FanOutConsumerDService"]["d"], boolean>
>;

/** LIB_FANOUT_E (max-density depends) types resolve correctly. */
export type _Assert_Case4_FanOutEPresent = ExpectTrue<
  TypeEqual<TServiceParams["fanout_e"], GetApis<LoadedModules["fanout_e"]>>
>;

// ═══════════════════════════════════════════════════════════════════════════════
// RUNTIME SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe("cross-package type-travel via depends/implies (compile-time proof)", () => {
  // ── Case 1 ────────────────────────────────────────────────────────────────
  describe("Case 1 — closure-pulled depends lib is typed on TServiceParams", () => {
    it("LIB_TRAVEL_BASE has a named function service", () => {
      expect(LIB_TRAVEL_BASE.name).toBe("travel_base");
      expect(typeof LIB_TRAVEL_BASE.services.TravelBaseService).toBe("function");
    });

    it("LIB_TRAVEL_ROOT depends array contains LIB_TRAVEL_BASE (runtime membership)", () => {
      expect(LIB_TRAVEL_ROOT.depends).toContain(LIB_TRAVEL_BASE);
    });

    it("compile-time: _Assert_Case1_TravelBasePresent and _Assert_Case1_CountIsNumber pass tsc", () => {
      // Type assertions above enforce this at compile time.
      // Runtime: confirm the service function exists.
      expect(typeof LIB_TRAVEL_BASE.services.TravelBaseService).toBe("function");
    });
  });

  // ── Case 2 ────────────────────────────────────────────────────────────────
  describe("Case 2 — direct LoadedModules key beats divergent LoadedRollups shape", () => {
    it("LIB_PRIORITY_DIRECT is defined with PriorityDirectService", () => {
      expect(LIB_PRIORITY_DIRECT.name).toBe("priority_direct");
      expect(LIB_PRIORITY_DIRECT.services.PriorityDirectService).toBeDefined();
    });

    it("compile-time: _Assert_Case2_DirectBeatsHoisted and _Assert_Case2_HoistedAbsent pass tsc", () => {
      // The @ts-expect-error on _Assert_Case2_HoistedAbsent would become unused
      // (a compile error) if the Omit guard broke and HoistedService appeared.
      expect(LIB_PRIORITY_DIRECT.services.PriorityDirectService).toBeDefined();
    });
  });

  // ── Case 3 ────────────────────────────────────────────────────────────────
  describe("Case 3 — const/arrow service key absent from TServiceParams", () => {
    it("LIB_CONST_ARROW exists but const_arrow is not in LoadedModules", () => {
      expect(LIB_CONST_ARROW).toBeDefined();
      // Verify the name is absent from the declared module keys at runtime.
      // The compile-time @ts-expect-error on _Assert_Case3_ConstArrowAbsent is
      // the real gate — this runtime check is just a sanity anchor.
      const name: string = LIB_CONST_ARROW.name;
      expect(name).toBe("const_arrow");
    });
  });

  // ── Case 4 ────────────────────────────────────────────────────────────────
  describe("Case 4 — fan-out: base depended-on by many libs; types stay sound", () => {
    it("all six fanout libraries have unique names", () => {
      const names = [
        LIB_FANOUT_BASE.name,
        LIB_FANOUT_A.name,
        LIB_FANOUT_B.name,
        LIB_FANOUT_C.name,
        LIB_FANOUT_D.name,
        LIB_FANOUT_E.name,
      ];
      expect(new Set(names).size).toBe(names.length);
    });

    it("LIB_FANOUT_E lists all peer fanout libs in depends", () => {
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_BASE);
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_A);
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_B);
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_C);
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_D);
    });

    it("compile-time: _Assert_Case4_FanOutBasePing, _Assert_Case4_AllSiblingsPresent, _Assert_Case4_FanOutEPresent pass tsc", () => {
      // Type assertions above enforce this.  Runtime: confirm all services exist.
      expect(LIB_FANOUT_BASE.services.FanOutBaseService).toBeDefined();
      expect(LIB_FANOUT_E.services.FanOutConsumerEService).toBeDefined();
    });
  });
});
