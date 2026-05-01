# CLAUDE.md — @digital-alchemy/core

## 1. What core is

`@digital-alchemy/core` is a zero-magic dependency-injection framework for TypeScript. There is no reflection, no decorators, no class hierarchy. Every service is a plain function that receives its dependencies through a single destructured parameter — `TServiceParams`.

```typescript
export function MyService({ logger, lifecycle, config }: TServiceParams) {
  lifecycle.onReady(() => {
    logger.info("ready");
  });
  return { doThing };
}
```

The framework wires up all declared services at bootstrap time, building a dependency graph from the `libraries` and `services` fields of each `CreateApplication` / `CreateLibrary` call. Once wired, every service receives its full `TServiceParams` synchronously (with async factories awaited).

This repo is the foundation every other `@digital-alchemy` library depends on. Changes to exports, lifecycle semantics, or `TServiceParams` shape ripple downstream into every consumer. Treat public API surface changes as breaking.

---

## 2. Repo orientation

### `src/services/*.mts` — stateful service factories

| File | Owns / responsibility | Read by |
|---|---|---|
| `als.service.mts` | `AsyncLocalStorage` wrapper; `enterWith`, `run`, `getStore`, `getLogData` | Logger (ALS log merging), any code needing per-request context |
| `configuration.service.mts` | Config state map, loader orchestration, proxy for `config.*`, `setConfig`, `mergeConfig`, `validateConfig`, `onUpdate` | `wiring.service.mts` at bootstrap; every service via `config` injection |
| `internal.service.mts` | `InternalDefinition` class (boot state, module maps, lifecycle ref); `InternalUtils` (object path get/set/del, `is`, `relativeDate`, `titleCase`); `safeExec` | All services — injected as `internal` |
| `is.service.mts` | `IsIt` class — type guards and small utilities (`array`, `boolean`, `empty`, `equal`, `function`, `object`, `string`, etc.); exports singleton `is` | Imported directly by `lifecycle.service.mts` and `wiring.service.mts` to break circular deps; everywhere else reached as `internal.utils.is` |
| `lifecycle.service.mts` | `CreateLifecycle` — per-bootstrap lifecycle event registry; priority-sorted callback execution across all seven stages | `wiring.service.mts` owns the lifecycle instance; services attach via `lifecycle.*` injection |
| `logger.service.mts` | `Logger` factory — chalk/stdout formatter, `context(ctx)` builder, level filtering, `addTarget`, `updateShouldLog`, ALS integration, `systemLogger` | Every service via `logger` injection; `internal.boilerplate.logger` |
| `scheduler.service.mts` | `Scheduler` factory — cron, interval, sliding, `setTimeout`, `setInterval`, `sleep`; registers stop callbacks for clean shutdown; returns a builder called with `(context: TContext)` | Every service via `scheduler` injection |
| `wiring.service.mts` | Bootstrap orchestration — `CreateApplication`, `wireService`, `CreateBoilerplate`, `teardown`, SIGINT/SIGTERM handling; owns `LIB_BOILERPLATE` | Entry point for all apps; do not call `wireService` directly |
| `index.mts` | Re-exports all service exports | Everything in `src/` imports from `../index.mts` |

### `src/helpers/*.mts` — pure logic, types, and utilities

**What distinguishes helpers from services:** helpers are side-effect-free modules containing types, utility functions, constants, and small classes. They do not receive `TServiceParams`. Services are factories that receive DI params and return an API object.

| File | Owns |
|---|---|
| `async.mts` | `each`, `eachSeries`, `eachLimit` — async iteration helpers that replace inconsistent `async` library behavior |
| `config-environment-loader.mts` | `ConfigLoaderEnvironment` — reads env vars and CLI switches; search order is `MODULE__KEY` (double-underscore) → `MODULE_KEY` (single-underscore) → `KEY` |
| `config-file-loader.mts` | `configLoaderFile`, `configFilePaths`, `loadConfigFromFile`, `withExtensions` — file-based config loading (JSON, YAML, INI, auto-detect) |
| `config.mts` | All config types (`AnyConfig`, `StringConfig`, `BooleanConfig`, etc.), `ConfigLoaderParams`, `ConfigLoaderReturn`, `findKey`, `iSearchKey`, `loadDotenv`, `parseConfig`, `KnownConfigs` |
| `context.mts` | `TContext` branded string type; `IContextBrand` |
| `cron.mts` | `CronExpression` enum, `TOffset`, `SchedulerCronOptions`, `SchedulerIntervalOptions`, `SchedulerSlidingOptions`, `DigitalAlchemyScheduler`, `SchedulerBuilder` |
| `errors.mts` | `BootstrapException` (wiring-time errors), `InternalError` (runtime errors) — both carry `context`, `cause`, `timestamp` |
| `events.mts` | Global error event name constants (`DIGITAL_ALCHEMY_NODE_GLOBAL_ERROR`, etc.) |
| `extend.mts` | `deepExtend`, `deepCloneArray`, `cloneSpecificValue` — deep merge utilities |
| `index.mts` | Re-exports all helper exports; new public helpers thread through here |
| `lifecycle.mts` | `TLifecycleBase`, `TLifeCycleRegister`, `LIFECYCLE_STAGES` array, `LifecycleStages` type, `LifecycleCallback` |
| `logger.mts` | `ILogger`, `TLoggerFunction`, `DigitalAlchemyLogger`, `GetLogger`, `METHOD_COLORS`, `fatalLog`, `EVENT_UPDATE_LOG_LEVELS` |
| `module.mts` | `createModule`, `DigitalAlchemyModule`, `ModuleExtension` — chainable module builder that can export to application, library, or test runner |
| `service-runner.mts` | `ServiceRunner` — minimal one-service bootstrap helper for scripts |
| `utilities.mts` | Numeric constants (`START`, `NONE`, `EMPTY`, `FIRST`, `ARRAY_OFFSET`, `SINGLE`, `UP`, `DOWN`, `MINUTE`, `HOUR`, `DAY`, `SECOND`, `YEAR`, etc.); `sleep`, `debounce`, `toOffsetMs`, `toOffsetDuration`, `SleepReturn`, `TBlackHole` |
| `wiring.mts` | `TServiceParams`, `ServiceFunction`, `ServiceMap`, `ApplicationDefinition`, `LibraryDefinition`, `BootstrapOptions`, `TInjectedConfig`, `LoadedModules`, `buildSortOrder`, `CreateLibrary`, `wireOrder`, `COERCE_CONTEXT`, `WIRE_PROJECT` |

### `src/testing/*.mts` — test infrastructure (not test cases)

| File | Owns |
|---|---|
| `mock-logger.mts` | `createMockLogger()` — returns a no-op `ILogger`; import in specs to suppress output |
| `test-module.mts` | `TestRunner` factory + `iTestRunner` interface — boots a real DI graph scoped to a test; chainable API: `.configure`, `.setOptions`, `.run`, `.serviceParams`, `.setup`, `.appendLibrary`, `.appendService`, `.replaceLibrary`, `.teardown` |
| `index.mts` | Re-exports `mock-logger` and `test-module` |

### `testing/` (sibling of `src/`, not inside it)

All `.spec.mts` files live here. Each spec file maps to a service or helper:
`als.spec.mts`, `configuration.spec.mts`, `internal.spec.mts`, `is.spec.mts`, `logger.spec.mts`, `scheduler.spec.mts`, `testing.spec.mts`, `utilities.spec.mts`, `wiring.spec.mts`. A `setup.mts` file and `pipelines/` subdirectory handle vitest global setup.

---

## 3. The TServiceParams pattern in core specifically

### Reaching `is`

**Inside core services and helpers**, use `internal.utils.is` — do not `import { is }` from the index:

```typescript
// correct inside a service factory
export function MyService({ internal }: TServiceParams) {
  const { is } = internal.utils;
  if (is.empty(value)) { ... }
}
```

**The one exception:** `is.service.mts` is imported directly in `lifecycle.service.mts` and `wiring.service.mts` to break a circular dependency that would form if they went through `../index.mts`. This is intentional — leave it.

### Dual-arity logger with `{ name: fnRef }` tagging

Every function entry logs with its own function reference as the `name` field. This appears in the rendered output as the function name, enabling precise call-site identification without string literals.

```typescript
function loadThing(id: string) {
  logger.trace({ name: loadThing, id }, "loading");
  // ...
  logger.debug({ name: loadThing }, "loaded");
}
```

Pass the function reference directly (not `loadThing.name`). The logger extracts `.name` from the object or function automatically.

### Lifecycle hook order

Hooks are attached in service constructors but executed by the wiring engine in strict order:

```
onPreInit → onPostConfig → onBootstrap → onReady
→ onPreShutdown → onShutdownStart → onShutdownComplete
```

- `onPreInit`: safe for attaching state; config is not yet loaded — do not read `config.*`
- `onPostConfig`: config values are available from this point forward
- `onBootstrap`: all modules are wired; safe to call other services
- `onReady`: app is fully running; schedulers start here
- `onPreShutdown` / `onShutdownStart` / `onShutdownComplete`: teardown in order

Each hook accepts an optional `priority` number. Positive priorities run first (high → low), un-prioritized callbacks run in parallel, negative priorities run last.

### No `metrics` injection

`TServiceParams` in this repo does not include `metrics`. Do not write `metrics.perf()`, `metrics.histogram(...)`, or any metrics-instrumentation patterns. Those patterns exist in sibling repos (e.g., vault-ts) that build on top of core. Core itself has no metrics service.

### `context: TContext` for builder-style services

`scheduler` is a builder: it returns a function that accepts `context: TContext` and returns the actual scheduler API. This is the pattern for any service that needs to bind per-caller context at use time:

```typescript
// wiring.service.mts — how scheduler is injected
scheduler: boilerplate?.scheduler?.(context),
```

Services that need to pass context down into callbacks capture the context injected into their own factory:

```typescript
export function MyService({ context, scheduler }: TServiceParams) {
  scheduler.cron({ exec: doWork, schedule: CronExpression.EVERY_MINUTE });
}
```

---

## 4. Style rules

### TSDoc

- Every exported factory function gets a TSDoc comment with at minimum a one-line summary.
- Every method on the returned object gets a one-line summary.
- Use `@remarks` for non-obvious behavior (e.g., "only valid after `onPostConfig`").
- Use `@throws` when the function throws a documented exception.
- `@internal` on symbols not intended for downstream consumers.

### Inline comments

Write `// why`, never `// what`. The code describes what. The comment explains the reason:

```typescript
// only read config after PostConfig fires; value is undefined before that
lifecycle.onPostConfig(() => {
  CURRENT_LOG_LEVEL = config.boilerplate.LOG_LEVEL;
});
```

### Logging conventions

```typescript
// entry — always trace with name + relevant inputs
logger.trace({ name: fnRef, ...inputs }, "brief description");

// decision points — trace
logger.trace({ name: fnRef, chosen }, "selected path");

// successful completion — debug
logger.debug({ name: fnRef }, "operation complete");

// expected-but-notable — info
// unexpected non-fatal — warn
// errors — error or fatal
```

### Error types

- `BootstrapException(context, "SCREAMING_SNAKE_CODE", "human message")` — for wiring failures, misconfiguration, or anything that should prevent boot.
- `InternalError(context, "CODE", "message")` — for runtime logic errors after boot.
- No bare `new Error(...)` in service or helper code.

### Hard prohibitions

- No `console.*` — use `logger.*` or `fatalLog` for last-resort stderr writes.
- No `process.stdout` writes.
- No `process.env.*` access outside of `config-environment-loader.mts` and `wiring.service.mts` (where `IS_TEST` / `NODE_ENV` defaults are set).
- No module-level side effects beyond constant declarations and `dayjs.extend(...)`.
- No `.catch()` — use `internal.safeExec` for wrapped async execution, or handle errors explicitly.
- No classic `for` / `for...of` loops — use `each`, `eachSeries`, `eachLimit`, `.forEach`, `.map`, `.filter`, `.some`, `.find`.
- No `ts-ignore` on new code; `ts-expect-error` is acceptable only with a comment explaining why.

### Cast restrictions

Follow the existing eslint config. In particular: `@typescript-eslint/no-magic-numbers` is enforced — declare named constants for non-obvious numeric literals.

---

## 5. Validation

All commands run from the repo root (`/home/zoe/Repos/DigitalAlchemyTS/core`).

### `yarn lint`

Runs eslint over `src/` and `testing/`. Must pass with zero errors and zero warnings. A clean run exits 0 with no output.

```bash
yarn lint
```

### `yarn test`

Runs vitest. All specs in `testing/` must pass. A clean run shows all tests green with no skipped specs (unless the test is explicitly marked `.skip` for a documented reason).

```bash
yarn test
```

### Type check the publish surface

```bash
tsc -p tsconfig.lib.json --noEmit
```

This checks only the files that end up in `dist/`. Errors here are publish-blocking.

### `yarn build`

Produces `dist/` cleanly. Use to verify the publish output compiles.

```bash
yarn build
```

### Do not touch

- `coverage/` — generated artifact, gitignored
- `node_modules/` — managed by yarn
- `yarn.lock` — only update deliberately with `yarn add` / `yarn remove`
- `dist/` — gitignored; never commit it

---

## 6. Footguns specific to core

### `wiring.mts` and `wiring.service.mts` — the engine was deliberately split

`helpers/wiring.mts` contains all the types and pure functions (`CreateLibrary`, `buildSortOrder`, `TServiceParams`, etc.). `services/wiring.service.mts` contains the runtime bootstrap logic (`CreateApplication`, `bootstrap`, `wireService`, `teardown`).

This split exists to break a circular reference that would form if types and the bootstrap runtime lived in the same file. **Do not merge them.** Read both before touching either. Changes to `TServiceParams` shape in `helpers/wiring.mts` affect every downstream library.

### `index.mts` is the re-export hub

`src/index.mts` re-exports everything. New public symbols thread through either `src/helpers/index.mts` or `src/services/index.mts` (whichever is appropriate), not directly into `src/index.mts`.

### Services import from `../index.mts`, not from siblings

Services import from `../index.mts` rather than directly from sibling files:

```typescript
// correct
import { deepExtend, eachSeries } from "../index.mts";

// wrong — breaks the circular-ref mitigation
import { deepExtend } from "./extend.mts";
```

The only exceptions are the deliberate direct imports in `lifecycle.service.mts` and `wiring.service.mts` of `is.service.mts`.

### `lifecycle.service.mts` imports `is` directly

`lifecycle.service.mts` and `wiring.service.mts` both `import { is } from "./is.service.mts"` instead of going through `../index.mts`. This breaks the circular dep that would form at module init time. Leave this pattern intact.

### `TestRunner` boots a real DI graph

`TestRunner` in `src/testing/test-module.mts` bootstraps a full application with real lifecycle execution. It is not a mock framework. This means:

- Lifecycle hooks fire in real order.
- Assertions inside `lifecycle.onPostConfig(...)` only see post-config values.
- Services passed to `.appendLibrary` / `.appendService` execute normally.
- Always call `.teardown()` in `afterEach` — open handles will keep vitest hanging.

Mocking depth matters: spying on a method only replaces that method, not the service it belongs to. When in doubt, use `.replaceLibrary` or inject a stub via `.appendService`.

### `configSources` controls loader activation

By default, `TestRunner` does not load env vars or config files (this is the safe default for tests). To test env-var resolution, pass `loadConfigs: true` or `setOptions({ configSources: { env: true } })`. To assert that env loading is disabled, pass `configSources: { env: false }`.

---

## 7. Where to find more

Long-form learning material — architecture overviews, declaration merging docs, advanced recipes — exists in a sibling documentation repository. Refer to that repo abstractly; its path and URL are out of scope here.

This `CLAUDE.md` is the canonical working reference for the `core` repo itself. When this file and external docs disagree about what to do *in this repo*, this file wins.
