# `implies` type propagation — demo + regression guard

A tiny two-package workspace that proves a non-obvious property of
`@digital-alchemy/core`: when a library lists another library in `implies`, a
downstream consumer that imports **only** the first library gets the second one
both **wired at runtime** and **fully typed at compile time** — with no
`LoadedRollups` registration and no manual re-export.

It is also a durable regression guard: it compiles and runs against the real
local core, so if a future TypeScript release changes how declaration-merge
augmentations travel across package boundaries, `run.sh` fails loudly.

## Run it

```bash
bash run.sh
```

That builds core, builds `@demo/home-libraries`, type-checks `@demo/home-app`
(the proof), then runs it (the demo). Expected output ends with the lights being
driven by a library the app never imported:

```
[INFO][living_room:Scenes]: ☀️  good morning
[INFO][lighting:Lights]: 💡 lights → 80%
[INFO][home:Routine]: lighting reports 80% — typed, no registration
```

## Layout

| Package | Role |
|---|---|
| `home-libraries/src/lighting.mts` | A plain library. Its service is a **named `function` declaration** — the load-bearing detail. |
| `home-libraries/src/living-room.mts` | `implies: [LIGHTING]` (membership + types) and `depends: [LIGHTING]` (wiring order). Registers only `living_room`. |
| `home-app/src/main.mts` | Imports **only** `LIVING_ROOM`, lists **only** `LIVING_ROOM`. Uses `params.lighting` — typed and live. |
| `home-app/src/proof.mts` | Type-only guard (`@ts-expect-error` probes) — never executed, only type-checked. |

## Why it works (and why named functions matter)

Capturing `implies` as a literal tuple makes the implier's emitted `.d.mts`
reference each member. With **named-function** services the reference is a real
module edge:

```ts
// living-room.d.mts — NAMED fn: a genuine import edge to lighting.mjs
readonly [LibraryDefinition<{ Lights: typeof import("./lighting.mjs").Lights }, …>]
```

That `import("./lighting.mjs")` pulls `lighting.d.mts` into the consumer's
program, so its `declare module { interface LoadedModules { lighting } }`
augmentation activates and `TServiceParams` gains `lighting` automatically.

An **arrow** service would be inlined anonymously with **no** edge:

```ts
// hypothetical arrow version — anonymous, no edge, augmentation never travels
readonly [LibraryDefinition<{ read: (p: TServiceParams) => { … } }, …>]
```

so the member would wire at runtime but `params.<member>` would be untyped. Named
function declarations are not a style preference here — they are what makes the
cross-package type edge exist.

## Membership vs. ordering

The two fields on `living_room` are orthogonal and both intentional:

- `implies: [LIGHTING]` — **membership + types.** The app can omit `lighting`
  from `libraries`; it is pulled into the resolved set and its types travel.
- `depends: [LIGHTING]` — **ordering only.** `params` is a wire-time snapshot, so
  `lighting` must wire *before* `living_room` for `Scenes` to call it.

Drop `implies` and the app must list `lighting` itself (or boot throws
`MISSING_DEPENDENCY`). Drop `depends` and `lighting` may wire after `living_room`,
leaving `params.lighting` undefined at call time.

## The core change this depends on

One thing: `CreateLibrary` captures `implies` as a `const` tuple, carried as a
third type parameter on `LibraryDefinition`. No `TServiceParams` machinery —
deriving member keys for `TServiceParams` directly is provably circular; letting
the member's own augmentation ride the import edge is what avoids that.
