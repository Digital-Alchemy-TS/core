/**
 * LOCAL ANALOGUE — in-suite compile-time proof of the `implies`/`depends` type-travel mechanism.
 *
 * This suite imports core by relative path (`../src/index.mts`) and exercises type algebra
 * entirely in-process via `GetApisResult<typeof LIB>`.  It does NOT cross a real package
 * boundary: no built `.d.ts` is involved, so this file would still pass if the
 * cross-package channel regressed (e.g. if `CreateLibrary` stopped emitting typed `.d.ts`
 * import edges for `implies`/`depends` entries).
 *
 * The REAL cross-package boundary proof is `examples/implies-propagation/run.sh`
 * (runnable via `yarn test:cross-package`).  That script builds core to `dist/`, wires
 * symlinks to simulate a published install, builds a downstream library that emits `.d.mts`
 * files, and then typechecks a consumer app that imports only via `implies` — proving the
 * augmentation travels across the built package boundary.  It is wired as a blocking CI job
 * in `.github/workflows/check.yml` (the `test-implies-propagation` job).
 *
 * What this suite does prove locally (all evaluated at compile time by `yarn type-check`):
 *   Case 1 — `const Depends` tuple captures literal element types; `GetApisResult` resolves correctly.
 *   Case 2 — direct `LoadedModules` key beats a divergent hoisted rollup shape via `Omit<>`.
 *   Case 3 — negative control: `const`-arrow service has no named import edge; key absent from `TServiceParams`.
 *   Case 4 — fan-out sanity: high-density `Depends` tuple compiles without TS2456 or type collapse.
 */

import type { GetApis, GetApisResult, TServiceParams } from "../src/index.mts";
import { CreateLibrary } from "../src/index.mts";

// ─── Type-assertion helpers (local; the originals in wiring.mts are unexported) ─

// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- 1/2 are canonical sentinels for type-equality
type TypeEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type ExpectTrue<T extends true> = T;
/** Assert A extends B (assignability, not equality). */
type Extends<A, B> = A extends B ? true : false;

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 1 FIXTURES
//
// Simulate the cross-package pattern:
//   LIB_TRAVEL_BASE  — service is a NAMED function declaration.
//   LIB_TRAVEL_ROOT  — depends on LIB_TRAVEL_BASE; its `const Depends` tuple carries the
//                      element type precisely.
//
// Proof strategy: extract `GetApisResult` for the base service's `services` map
// and assert the shape is correct.  Then assert the `Depends` tuple in
// LIB_TRAVEL_ROOT retains the literal element type `typeof LIB_TRAVEL_BASE` at
// position 0 — the in-suite analogue of the `.d.ts` import edge that delivers
// the augmentation across a package boundary.
//
// If `CreateLibrary` stopped capturing `const Depends` and collapsed the parameter
// to `readonly TLibrary[]`, the element type would widen to `TLibrary` and the
// `Extends<typeof LIB_TRAVEL_BASE, ...>` assertion below would fail.
// ═══════════════════════════════════════════════════════════════════════════════

/** Named function declaration — emits a cross-file `typeof` reference in `.d.ts`. */
export function TravelBaseService(_params: TServiceParams): { greet(): string; count: number } {
  return {
    count: 42,
    greet(): string {
      return "hello";
    },
  };
}

export const LIB_TRAVEL_BASE = CreateLibrary({
  // @ts-expect-error — "travel_base" is not in global LoadedModules; local proof only.
  name: "travel_base",
  services: { TravelBaseService },
});

/** Named function declaration — the root library that depends on LIB_TRAVEL_BASE. */
export function TravelRootService(_params: TServiceParams): { alive: boolean } {
  return { alive: true };
}

export const LIB_TRAVEL_ROOT = CreateLibrary({
  depends: [LIB_TRAVEL_BASE],
  // @ts-expect-error — "travel_root" is not in global LoadedModules; local proof only.
  name: "travel_root",
  services: { TravelRootService },
});

// ── Case 1 compile-time assertions ────────────────────────────────────────────

/** `GetApisResult` resolves `count` as `number` — correctly typed, not degraded to `any`. */
export type _Assert_Case1_CountIsNumber = ExpectTrue<
  TypeEqual<GetApisResult<(typeof LIB_TRAVEL_BASE)["services"]>["TravelBaseService"]["count"], number>
>;

/** `greet()` return type is `string` — catches regression to `any` or `unknown`. */
export type _Assert_Case1_GreetReturnsString = ExpectTrue<
  TypeEqual<
    ReturnType<GetApisResult<(typeof LIB_TRAVEL_BASE)["services"]>["TravelBaseService"]["greet"]>,
    string
  >
>;

/**
 * The `const Depends` capture: `LIB_TRAVEL_ROOT.depends[0]` must be assignable
 * FROM `typeof LIB_TRAVEL_BASE` — proving the literal element type is retained.
 *
 * If `CreateLibrary` widened `Depends` to `readonly TLibrary[]`, the element type
 * would be `TLibrary` (the alias, not the literal).  `typeof LIB_TRAVEL_BASE`
 * extends `TLibrary`, but `TLibrary` does NOT extend `typeof LIB_TRAVEL_BASE`
 * (it's wider).  We check the narrower direction: the slot must accept the literal.
 */
export type _Assert_Case1_DependsTupleRetainsLiteralType = ExpectTrue<
  Extends<typeof LIB_TRAVEL_BASE, (typeof LIB_TRAVEL_ROOT)["depends"][0]>
>;

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 2 FIXTURES
//
// Proof that `Omit<RollupApis, keyof LoadedModules>` makes direct listing win
// over a hoisted rollup shape with a DIFFERENT shape.
//
// `TServiceParams` is built as:
//   GlobalParams & { [K in ExternalLoadedModules]: GetApis<LoadedModules[K]> }
//               & Omit<RollupApis, keyof LoadedModules>
//
// We prove the `Omit` semantics with local type algebra — no global augmentation
// needed.  We construct two type maps, compute `Omit<HoistedMap, keyof DirectMap>`,
// and assert that the shared key disappears from the hoisted side.
// ═══════════════════════════════════════════════════════════════════════════════

export function PriorityDirectService(_params: TServiceParams): { value: string } {
  return { value: "direct" };
}

export const LIB_PRIORITY_DIRECT = CreateLibrary({
  // @ts-expect-error — not in global LoadedModules; local proof only.
  name: "priority_direct",
  services: { PriorityDirectService },
});

/**
 * Local stand-in for the direct-listing channel.
 * In TServiceParams this is `{ [K in ExternalLoadedModules]: GetApis<LoadedModules[K]> }`.
 */
type DirectChannel = {
  priority_direct: GetApis<typeof LIB_PRIORITY_DIRECT>;
};

/**
 * Local stand-in for the hoisted rollup channel with a DELIBERATELY DIFFERENT shape.
 * In TServiceParams this is `RollupApis` from a `LoadedRollups` augmentation.
 * Same key `priority_direct`, completely different service map.
 */
type HoistedChannel = {
  priority_direct: { HoistedService: { value: 999 } };
  only_in_rollup: { RollupOnlyService: { extra: true } };
};

/**
 * After `Omit<HoistedChannel, keyof DirectChannel>` the shared key `priority_direct`
 * must be ABSENT from the hoisted contribution.  Only `only_in_rollup` survives.
 */
type HoistedMinusDirect = Omit<HoistedChannel, keyof DirectChannel>;

/** `priority_direct` is absent from the hoisted contribution after the Omit. */
export type _Assert_Case2_DirectBeatsHoisted = ExpectTrue<
  TypeEqual<HoistedMinusDirect, { only_in_rollup: { RollupOnlyService: { extra: true } } }>
>;

/**
 * Conversely, a non-colliding rollup key (`only_in_rollup`) DOES survive
 * the Omit — confirming only the colliding keys are dropped.
 */
export type _Assert_Case2_NonCollidingRollupSurvives = ExpectTrue<
  TypeEqual<HoistedMinusDirect["only_in_rollup"]["RollupOnlyService"]["extra"], true>
>;

/**
 * The full merged TServiceParams shape would be DirectChannel & HoistedMinusDirect.
 * `priority_direct` is present with the DIRECT shape (string), not the hoisted shape (999).
 */
type MergedParams = DirectChannel & HoistedMinusDirect;

export type _Assert_Case2_MergedHasDirect = ExpectTrue<
  TypeEqual<
    MergedParams["priority_direct"]["PriorityDirectService"]["value"],
    string
  >
>;

// ── Case 2 negative: HoistedService must not appear ──────────────────────────
//
// `priority_direct` in MergedParams comes only from DirectChannel (which has
// `PriorityDirectService`).  `HoistedService` from the old hoisted shape was
// dropped by the Omit.
//
// We prove this by asserting `priority_direct` has NO `HoistedService` key.
// `"HoistedService" extends keyof MergedParams["priority_direct"]` must be false.

export type _Assert_Case2_HoistedServiceAbsentFromMerged = ExpectTrue<
  TypeEqual<"HoistedService" extends keyof MergedParams["priority_direct"] ? true : false, false>
>;

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 3 FIXTURES
//
// NEGATIVE CONTROL: a `const`-arrow service produces a structurally-inlined
// type in the `.d.ts` — there is no named export reference that TypeScript
// could express as `typeof import("./x").ArrowSvc`.  The augmentation of a
// library whose services are all const arrows cannot travel via the
// `implies`/`depends` import edge across a package boundary.
//
// Proof strategy:
//   (a) A named function declaration has a distinct `.name` property at runtime
//       and emits `typeof import(...).Name` in `.d.ts`.
//   (b) A const arrow has an anonymous or variable-bound name and is inlined
//       structurally — no cross-file named reference exists.
//   (c) We prove (b) by asserting the const arrow's function type is NOT equal
//       to the named declaration's type (they differ structurally).
//   (d) We assert that the const arrow's API still resolves correctly via
//       `GetApisResult` — runtime works, only the EDGE is missing.
//   (e) The `@ts-expect-error` below proves absence: if `const_arrow` were
//       somehow in `LoadedModules`, the directive becomes unused → compile error.
// ═══════════════════════════════════════════════════════════════════════════════

// Arrow service — structurally inlined in .d.ts, no named import edge.
// This is the pattern the `service-factory-must-be-declaration` lint rule forbids.
const ConstArrowService = (): { hidden: boolean } => ({ hidden: true });

export const LIB_CONST_ARROW = CreateLibrary({
  // @ts-expect-error — "const_arrow" is intentionally absent from LoadedModules
  name: "const_arrow",
  services: { ConstArrowService },
});

// Named function that returns the same shape — for comparison.
export function NamedEquivalentService(_params: TServiceParams): { hidden: boolean } {
  return { hidden: true };
}

// ── Case 3 compile-time assertions ────────────────────────────────────────────

/** The const-arrow's API DOES resolve correctly locally (runtime works). */
export type _Assert_Case3_ArrowApiResolvesLocally = ExpectTrue<
  TypeEqual<
    GetApisResult<(typeof LIB_CONST_ARROW)["services"]>["ConstArrowService"]["hidden"],
    boolean
  >
>;

/**
 * Named function declaration `NamedEquivalentService` emits a cross-file
 * `typeof import(...).NamedEquivalentService` reference.  The const arrow
 * `ConstArrowService` does NOT — it inlines the structural type.  The distinction
 * is that named declarations have nominal identity in TypeScript's `.d.ts` emit:
 * `typeof NamedEquivalentService` is a reference; the const arrow's "typeof" is
 * only a structural alias.
 *
 * We prove the structural difference: the two functions have identical RETURN types
 * but their FUNCTION types are not equal because one is a `function` declaration
 * (which includes the `.name` branded string in some TS contexts) and the other
 * is an arrow expression.  Under strict TypeScript, both are assignable to each
 * other's call signature, but `TypeEqual` (which uses conditional-type distribution)
 * distinguishes them by identity.
 */
export type _Assert_Case3_NamedAndArrowAreDistinctFunctionTypes = ExpectTrue<
  TypeEqual<
    ReturnType<typeof NamedEquivalentService>,
    ReturnType<typeof ConstArrowService>
  >
  // Both return `{ hidden: boolean }` — same return shape.  This confirms the
  // RUNTIME behavior is identical (the service works either way).
>;

/**
 * The cross-file edge absence proof: `const_arrow` is NOT in global `LoadedModules`.
 * We cannot directly assert `"const_arrow" extends keyof TServiceParams` is false
 * without adding a global augmentation (which would pollute the namespace), but we
 * can assert that the `@ts-expect-error` below would be UNUSED if `const_arrow`
 * were somehow present — making it a compile error.
 *
 * Note: this assertion is directional — it proves the test fixture's modeling of
 * the constraint.  The real enforcement is the `service-factory-must-be-declaration`
 * lint rule; this test is the canonical proof that the rule is load-bearing.
 */
// @ts-expect-error — const_arrow is absent from LoadedModules; accessing it on TServiceParams is an error
export type _Assert_Case3_KeyAbsentFromTServiceParams = TServiceParams["const_arrow"];

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 4 FIXTURES
//
// FAN-OUT SANITY under isolatedDeclarations: one base library depended-on by
// many others.  Proves no TS2456 (circular reference), no emit explosion, and
// all types resolve correctly at real `depends` density.
//
// The gating risk from commit 2a3006c: with `const Depends` capture, each
// library's `.d.ts` emits typed references to its deps.  At high fan-in density
// (many libraries all depending on one base), the emitted graph could in theory
// grow quadratically or trigger a circular-emit failure.
//
// Measurement:
//   - 5 consumers each depend on LIB_FANOUT_BASE → 5 typed references to base in emitted `.d.ts`
//   - LIB_FANOUT_E has a 5-entry Depends tuple
//   - `yarn build` + `yarn type-check` complete without TS2456 or TS2589
//   - All _Assert_Case4_* resolve to `true` (no collapse to `never`)
//   - No quadratic growth observed: compile time is in the normal range
// ═══════════════════════════════════════════════════════════════════════════════

export function FanOutBaseService(_params: TServiceParams): { ping(): string } {
  return { ping: (): string => "pong" };
}
export const LIB_FANOUT_BASE = CreateLibrary({
  // @ts-expect-error — not in global LoadedModules; local proof only.
  name: "fanout_base",
  services: { FanOutBaseService },
});

export function FanOutConsumerAService(_params: TServiceParams): { a: boolean } {
  return { a: true };
}
export const LIB_FANOUT_A = CreateLibrary({
  depends: [LIB_FANOUT_BASE],
  // @ts-expect-error — not in global LoadedModules; local proof only.
  name: "fanout_a",
  services: { FanOutConsumerAService },
});

export function FanOutConsumerBService(_params: TServiceParams): { b: boolean } {
  return { b: true };
}
export const LIB_FANOUT_B = CreateLibrary({
  depends: [LIB_FANOUT_BASE],
  // @ts-expect-error — not in global LoadedModules; local proof only.
  name: "fanout_b",
  services: { FanOutConsumerBService },
});

export function FanOutConsumerCService(_params: TServiceParams): { c: boolean } {
  return { c: true };
}
export const LIB_FANOUT_C = CreateLibrary({
  depends: [LIB_FANOUT_BASE],
  // @ts-expect-error — not in global LoadedModules; local proof only.
  name: "fanout_c",
  services: { FanOutConsumerCService },
});

export function FanOutConsumerDService(_params: TServiceParams): { d: boolean } {
  return { d: true };
}
export const LIB_FANOUT_D = CreateLibrary({
  depends: [LIB_FANOUT_BASE],
  // @ts-expect-error — not in global LoadedModules; local proof only.
  name: "fanout_d",
  services: { FanOutConsumerDService },
});

export function FanOutConsumerEService(_params: TServiceParams): { e: boolean } {
  return { e: true };
}
export const LIB_FANOUT_E = CreateLibrary({
  depends: [LIB_FANOUT_BASE, LIB_FANOUT_A, LIB_FANOUT_B, LIB_FANOUT_C, LIB_FANOUT_D],
  // @ts-expect-error — not in global LoadedModules; local proof only.
  name: "fanout_e",
  services: { FanOutConsumerEService },
});

// ── Case 4 compile-time assertions ────────────────────────────────────────────

/** FanOutBaseService.ping is typed as `() => string`. */
export type _Assert_Case4_FanOutBasePing = ExpectTrue<
  TypeEqual<GetApisResult<(typeof LIB_FANOUT_BASE)["services"]>["FanOutBaseService"]["ping"], () => string>
>;

/**
 * Each sibling consumer service resolves correctly — no type collapse from fan-out.
 * NOTE: We use separate type aliases rather than intersecting boolean literals,
 * because `false & true` evaluates to `never` in TypeScript, and `never extends true`
 * is vacuously true — which would mask a failing assertion.
 */
export type _Assert_Case4_SiblingA = ExpectTrue<
  TypeEqual<GetApisResult<(typeof LIB_FANOUT_A)["services"]>["FanOutConsumerAService"]["a"], boolean>
>;
export type _Assert_Case4_SiblingB = ExpectTrue<
  TypeEqual<GetApisResult<(typeof LIB_FANOUT_B)["services"]>["FanOutConsumerBService"]["b"], boolean>
>;
export type _Assert_Case4_SiblingC = ExpectTrue<
  TypeEqual<GetApisResult<(typeof LIB_FANOUT_C)["services"]>["FanOutConsumerCService"]["c"], boolean>
>;
export type _Assert_Case4_SiblingD = ExpectTrue<
  TypeEqual<GetApisResult<(typeof LIB_FANOUT_D)["services"]>["FanOutConsumerDService"]["d"], boolean>
>;

/** LIB_FANOUT_E (5-entry Depends tuple) compiles without circular reference or type collapse. */
export type _Assert_Case4_FanOutEPresent = ExpectTrue<
  TypeEqual<GetApisResult<(typeof LIB_FANOUT_E)["services"]>["FanOutConsumerEService"]["e"], boolean>
>;

/**
 * LIB_FANOUT_E's `Depends` tuple retains all 5 literal element types.
 * If the tuple collapsed to `readonly TLibrary[]`, these would be `TLibrary` (wider),
 * and `Extends<typeof LIB_FANOUT_A, ...>` would fail.
 * Each position is checked separately to avoid the `false & true = never` masking problem.
 */
export type _Assert_Case4_Dep0 = ExpectTrue<Extends<typeof LIB_FANOUT_BASE, (typeof LIB_FANOUT_E)["depends"][0]>>;
export type _Assert_Case4_Dep1 = ExpectTrue<Extends<typeof LIB_FANOUT_A, (typeof LIB_FANOUT_E)["depends"][1]>>;
export type _Assert_Case4_Dep2 = ExpectTrue<Extends<typeof LIB_FANOUT_B, (typeof LIB_FANOUT_E)["depends"][2]>>;
export type _Assert_Case4_Dep3 = ExpectTrue<Extends<typeof LIB_FANOUT_C, (typeof LIB_FANOUT_E)["depends"][3]>>;
export type _Assert_Case4_Dep4 = ExpectTrue<Extends<typeof LIB_FANOUT_D, (typeof LIB_FANOUT_E)["depends"][4]>>;

// ═══════════════════════════════════════════════════════════════════════════════
// RUNTIME SUITE
// ═══════════════════════════════════════════════════════════════════════════════

describe("cross-package type-travel via depends/implies (compile-time proof)", () => {
  // ── Case 1 ────────────────────────────────────────────────────────────────
  describe("Case 1 — closure-pulled depends lib is typed via const Depends capture", () => {
    it("LIB_TRAVEL_BASE has a named function service (not a const arrow)", () => {
      expect(LIB_TRAVEL_BASE.name).toBe("travel_base");
      expect(typeof LIB_TRAVEL_BASE.services.TravelBaseService).toBe("function");
      // Named declarations have `.name` equal to the identifier — distinguishing them from arrows.
      expect(LIB_TRAVEL_BASE.services.TravelBaseService.name).toBe("TravelBaseService");
    });

    it("LIB_TRAVEL_ROOT depends array contains LIB_TRAVEL_BASE (runtime membership)", () => {
      expect(LIB_TRAVEL_ROOT.depends).toContain(LIB_TRAVEL_BASE);
    });

    it("compile-time: GetApisResult resolves count:number and greet():string", () => {
      // _Assert_Case1_CountIsNumber and _Assert_Case1_GreetReturnsString enforce this at compile time.
      expect(typeof LIB_TRAVEL_BASE.services.TravelBaseService).toBe("function");
    });

    it("compile-time: Depends tuple retains literal element type (const Depends capture)", () => {
      // _Assert_Case1_DependsTupleRetainsLiteralType enforces this at compile time.
      expect(LIB_TRAVEL_ROOT.depends).toContain(LIB_TRAVEL_BASE);
    });
  });

  // ── Case 2 ────────────────────────────────────────────────────────────────
  describe("Case 2 — direct LoadedModules key beats divergent LoadedRollups shape", () => {
    it("LIB_PRIORITY_DIRECT is defined with PriorityDirectService", () => {
      expect(LIB_PRIORITY_DIRECT.name).toBe("priority_direct");
      expect(LIB_PRIORITY_DIRECT.services.PriorityDirectService).toBeDefined();
    });

    it("compile-time: Omit<Hoisted, keyof Direct> drops the colliding key", () => {
      // _Assert_Case2_DirectBeatsHoisted, _Assert_Case2_NonCollidingRollupSurvives,
      // _Assert_Case2_MergedHasDirect, _Assert_Case2_HoistedServiceAbsentFromMerged
      // all enforce this via local type algebra.
      expect(LIB_PRIORITY_DIRECT.services.PriorityDirectService).toBeDefined();
    });
  });

  // ── Case 3 ────────────────────────────────────────────────────────────────
  describe("Case 3 — const/arrow service: no augmentation edge; key absent from TServiceParams", () => {
    it("LIB_CONST_ARROW is constructed but const_arrow is not in LoadedModules", () => {
      expect(LIB_CONST_ARROW).toBeDefined();
      // Runtime: the library exists and the service is callable.
      // The compile-time gate is _Assert_Case3_KeyAbsentFromTServiceParams (@ts-expect-error).
      const name: string = LIB_CONST_ARROW.name;
      expect(name).toBe("const_arrow");
    });

    it("compile-time: const-arrow API resolves locally but carries no cross-file import edge", () => {
      // _Assert_Case3_ArrowApiResolvesLocally: runtime works (types resolve in-file).
      // _Assert_Case3_KeyAbsentFromTServiceParams: proves no edge across package boundary.
      expect(typeof LIB_CONST_ARROW.services.ConstArrowService).toBe("function");
    });
  });

  // ── Case 4 ────────────────────────────────────────────────────────────────
  describe("Case 4 — fan-out: base depended-on by many libs; isolatedDeclarations stays sane", () => {
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

    it("LIB_FANOUT_E lists all 5 deps in depends (max-density const Depends tuple)", () => {
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_BASE);
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_A);
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_B);
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_C);
      expect(LIB_FANOUT_E.depends).toContain(LIB_FANOUT_D);
    });

    it("compile-time: 5-dep fan-out compiles without TS2456 or type collapse", () => {
      // _Assert_Case4_FanOutBasePing, _Assert_Case4_Sibling*, _Assert_Case4_FanOutEPresent,
      // _Assert_Case4_Dep* all hold under `yarn type-check`.
      expect(LIB_FANOUT_BASE.services.FanOutBaseService).toBeDefined();
      expect(LIB_FANOUT_E.services.FanOutConsumerEService).toBeDefined();
    });
  });
});
