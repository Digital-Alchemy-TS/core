import type { Except, Merge } from "type-fest";

import type { iTestRunner } from "../index.mts";
import { CreateApplication, TestRunner } from "../index.mts";
import type { OptionalModuleConfiguration } from "./config.mts";
import type { TContext } from "./context.mts";
import { BootstrapException } from "./errors.mts";
import { deepExtend } from "./extend.mts";
import type {
  ApplicationDefinition,
  LibraryDefinition,
  ServiceFunction,
  ServiceMap,
  TLibrary,
} from "./wiring.mts";
import { CreateLibrary } from "./wiring.mts";

// pure-helper file has no TServiceParams; tag bootstrap errors with a stable
// module-scoped context so consumers can identify the origin in stack traces
const MODULE_CONTEXT = "digital-alchemy:module" as TContext;

// --- Option types -------------------------------------------------------------

/**
 * Options that control how {@link DigitalAlchemyModule.extend} behaves when
 * forking a module into a modified copy.
 */
export type ExtendOptions = {
  /** Override the name given to the extended module. */
  name?: string;
  /**
   * default: true
   */
  keepConfiguration?: boolean;
};

// --- Core module types --------------------------------------------------------

/**
 * Intermediate representation of a Digital Alchemy module before it is
 * committed to a concrete form (library, application, or test runner).
 *
 * @remarks
 * A `DigitalAlchemyModule` holds the full set of services and configuration
 * that would be passed to `CreateLibrary` or `CreateApplication`, but defers
 * that commitment so callers can compose and mutate before export.
 *
 * Call `.extend()` to obtain a {@link ModuleExtension} builder, then chain
 * mutations before finalising with `.toLibrary()`, `.toApplication()`, or
 * `.toTest()`.
 */
export type DigitalAlchemyModule<S extends ServiceMap, C extends OptionalModuleConfiguration> = {
  services: S;
  configuration: C;
  name: string;
  depends: TLibrary[];
  optionalDepends?: TLibrary[];
  priorityInit: string[];
  extend: (options?: ExtendOptions) => ModuleExtension<S, C>;
};

/**
 * Input shape required to construct a {@link DigitalAlchemyModule}.
 *
 * @remarks
 * Mirrors `LibraryConfigurationOptions` but without the `type` discriminant or
 * the runtime wiring symbol — those are added by `CreateLibrary` /
 * `CreateApplication` at export time.
 */
export type CreateModuleOptions<S extends ServiceMap, C extends OptionalModuleConfiguration> = {
  services: S;
  configuration: C;
  name: string;
  depends: TLibrary[];
  optionalDepends?: TLibrary[];
  priorityInit: string[];
};

/**
 * Chainable builder returned by {@link DigitalAlchemyModule.extend}.
 *
 * @remarks
 * Each mutation method returns the same `ModuleExtension` instance (or a
 * narrowed variant of it), enabling fluent composition. The builder holds
 * mutable references to the service map and dependency list; calling any
 * terminal method (`.toLibrary()`, `.toApplication()`, `.toTest()`) reads the
 * current state and produces an immutable definition.
 *
 * **Method categories:**
 * - *Dependency mutations:* `appendLibrary`, `replaceLibrary`
 * - *Service mutations:* `appendService`, `replaceService`, `pickService`,
 *   `omitService`, `rebuild`
 * - *Terminal exports:* `toApplication`, `toLibrary`, `toTest`
 *
 * commands mutate module
 */
export type ModuleExtension<S extends ServiceMap, C extends OptionalModuleConfiguration> = {
  /**
   * Add a new library dependency not present in the base module.
   *
   * @remarks
   * Throws if the library name is already appended or exists in the base
   * `depends` list — use `replaceLibrary` in that case.
   */
  appendLibrary: (library: TLibrary) => ModuleExtension<S, C>;

  /**
   * Inject an additional service that is not declared in the base module.
   *
   * @remarks
   * Throws if a service with the same name already exists — use
   * `replaceService` in that case.
   */
  appendService: (name: string, target: ServiceFunction) => ModuleExtension<S, C>;

  /**
   * Swap a library dependency by name.
   *
   * name must match existing library
   */
  replaceLibrary: (library: TLibrary) => ModuleExtension<S, C>;

  /**
   * Swap an existing service implementation while keeping the same key.
   *
   * @remarks
   * The return type is narrowed to reflect the new function's signature.
   * Throws if `name` does not exist in the current service map.
   *
   * name must match existing service
   */
  replaceService: <TARGET extends keyof S, FN extends ServiceFunction>(
    name: TARGET,
    target: FN,
  ) => ModuleExtension<Merge<S, { [key in TARGET]: FN }>, C>;

  /**
   * Reduce the service map to only the named services.
   *
   * @remarks
   * Throws if any supplied name does not exist in the current service map.
   *
   * throws if any service does not exist
   */
  pickService: <PICK extends keyof S>(...services: PICK[]) => ModuleExtension<Pick<S, PICK>, C>;

  /**
   * Remove specific services from the service map.
   *
   * @remarks
   * Throws if any supplied name does not exist in the current service map.
   *
   * throws if any service does not exist
   */
  omitService: <OMIT extends keyof S>(...services: OMIT[]) => ModuleExtension<Except<S, OMIT>, C>;

  /**
   * Replace the entire service map with a new set.
   *
   * @remarks
   * `services` must extend `S` (i.e., it must be API-compatible with the
   * original map). Use when rebuilding several services at once.
   *
   * build api compatible replacement (potentially adding)
   */
  rebuild: <REPLACEMENTS extends S>(
    services: Partial<REPLACEMENTS>,
  ) => ModuleExtension<REPLACEMENTS, C>;

  /**
   * Finalise as an {@link ApplicationDefinition} for use with `bootstrap`.
   *
   * export as application
   */
  toApplication: () => ApplicationDefinition<S, C>;

  /**
   * Finalise as a {@link LibraryDefinition} for use as a dependency.
   *
   * export as library
   */
  toLibrary: () => LibraryDefinition<S, C>;

  /**
   * Finalise as an `iTestRunner` for use in vitest specs.
   *
   * @remarks
   * Internally calls `.toApplication()` and wraps the result in a `TestRunner`.
   * Prefer `.toTest()` in spec files over manually constructing both.
   *
   * export as test
   */
  toTest: () => iTestRunner<S, C>;
};

// --- createModule factory -----------------------------------------------------

/**
 * Construct a new {@link DigitalAlchemyModule} from a raw options object.
 *
 * @remarks
 * `createModule` is the entry point for the chainable module pattern. It
 * captures the options into a working module object and exposes `.extend()` to
 * begin the mutation chain. No library or application definition is produced
 * until a terminal method is called on the resulting {@link ModuleExtension}.
 *
 * Use the static helpers `createModule.fromApplication` and
 * `createModule.fromLibrary` to seed the builder from an existing definition
 * instead of building from scratch.
 *
 * Typical call sequence:
 * ```typescript
 * createModule({ name: "my-lib", services, configuration, depends: [], priorityInit: [] })
 *   .extend()
 *   .appendLibrary(someLibrary)
 *   .toLibrary();
 * ```
 */
export function createModule<S extends ServiceMap, C extends OptionalModuleConfiguration>(
  options: CreateModuleOptions<S, C>,
): DigitalAlchemyModule<S, C> {
  function extend(extendOptions: ExtendOptions) {
    const appendLibrary = new Map<string, TLibrary>();
    let services = { ...workingModule.services };

    const extend: ModuleExtension<S, C> = {
      appendLibrary: (library: TLibrary) => {
        const name = library.name;
        if (appendLibrary.has(name)) {
          throw new BootstrapException(
            MODULE_CONTEXT,
            "LIBRARY_ALREADY_APPENDED",
            `${name} already is appended`,
          );
        }
        const exists = workingModule.depends.some(i => i.name === name);
        if (exists) {
          // base depends list owns this name; callers must use replaceLibrary to swap it
          throw new BootstrapException(
            MODULE_CONTEXT,
            "LIBRARY_USE_REPLACE",
            `${name} exists as a library in base, use replaceLibrary`,
          );
        }
        appendLibrary.set(name, library);
        return extend;
      },
      appendService: (name: string, service: ServiceFunction) => {
        if (name in services) {
          // service already registered; callers must explicitly opt into replacement
          throw new BootstrapException(
            MODULE_CONTEXT,
            "SERVICE_USE_REPLACE",
            `${name} exists as a service in base, use replaceService`,
          );
        }
        // @ts-expect-error the interface makes this type properly, idc
        services[name] = service;
        return extend;
      },
      omitService: <OMIT extends keyof S>(...keys: OMIT[]) => {
        services = Object.fromEntries(
          Object.entries(services).filter(([i]) => !keys.includes(i as OMIT)),
        ) as typeof services;
        return extend as unknown as ModuleExtension<Except<S, OMIT>, C>;
      },
      pickService: <PICK extends keyof S>(...keys: PICK[]) => {
        services = Object.fromEntries(
          Object.entries(services).filter(([i]) => keys.includes(i as PICK)),
        ) as typeof services;
        return extend as unknown as ModuleExtension<Pick<S, PICK>, C>;
      },
      rebuild: <REPLACEMENTS extends S>(incoming: Partial<REPLACEMENTS>) => {
        services = incoming as REPLACEMENTS;
        return extend as unknown as ModuleExtension<REPLACEMENTS, C>;
      },
      replaceLibrary: (library: TLibrary) => {
        const name = library.name;
        if (appendLibrary.has(name)) {
          // already in the appended set — replace in-place
          appendLibrary.set(name, library);
        } else {
          const exists = workingModule.depends.some(i => i.name === name);
          if (!exists) {
            // neither appended nor in base depends; require explicit append first
            throw new BootstrapException(
              MODULE_CONTEXT,
              "LIBRARY_NOT_FOUND",
              `${name} does not exist in module yet`,
            );
          }
          appendLibrary.set(name, library);
        }
        return extend;
      },
      // @ts-expect-error I don't care
      replaceService: <TARGET extends keyof S, FN extends ServiceFunction>(
        name: TARGET,
        target: FN,
      ) => {
        if (!(name in services)) {
          throw new BootstrapException(
            MODULE_CONTEXT,
            "SERVICE_NOT_FOUND",
            `${String(name)} does not exist to replace`,
          );
        }
        // @ts-expect-error I don't care
        services[name] = target;
        return extend;
      },
      toApplication: () => {
        // merge base depends and appended libraries; appended wins on name collision
        const depends = {} as Record<string, TLibrary>;
        workingModule.depends?.forEach(i => (depends[i.name] = i));
        appendLibrary.forEach((value, key) => (depends[key] = value));

        return CreateApplication({
          configuration: deepExtend({}, workingModule.configuration),
          libraries: Object.values(depends),
          // @ts-expect-error wrapper problems
          name: extendOptions?.name || options.name,
          // @ts-expect-error wrapper problems
          priorityInit: [...(workingModule.priorityInit ?? [])],
          services,
        });
      },
      toLibrary: () => {
        // same merge logic as toApplication; both export forms share the same dependency union
        const depends = {} as Record<string, TLibrary>;
        workingModule.depends?.forEach(i => (depends[i.name] = i));
        appendLibrary.forEach((value, key) => (depends[key] = value));

        return CreateLibrary({
          configuration: deepExtend({}, workingModule.configuration),
          depends: Object.values(depends),
          // @ts-expect-error wrapper problems
          name: extendOptions?.name || options.name,
          optionalDepends: workingModule.optionalDepends,
          // @ts-expect-error wrapper problems
          priorityInit: [...workingModule.priorityInit],
          services,
        });
      },
      toTest: () => {
        return TestRunner({ target: extend.toApplication() });
      },
    };
    return extend;
  }

  const workingModule: DigitalAlchemyModule<S, C> = {
    configuration: options.configuration,
    depends: options.depends,
    extend,
    name: options.name,
    optionalDepends: options.optionalDepends ?? [],
    priorityInit: options.priorityInit,
    services: options.services ?? ({} as S),
  };
  return workingModule;
}

// --- Static helpers on createModule -------------------------------------------

/**
 * Seed a {@link DigitalAlchemyModule} from an existing
 * {@link ApplicationDefinition}.
 *
 * @remarks
 * Copies services, configuration, libraries, and `priorityInit` into the
 * intermediate module shape so callers can fork and modify an application
 * without reconstructing it from scratch.
 */
// #MARK: fromApplication
createModule.fromApplication = <S extends ServiceMap, C extends OptionalModuleConfiguration>(
  application: ApplicationDefinition<S, C>,
) => {
  return createModule<S, C>({
    configuration: application.configuration,
    depends: application.libraries,
    name: application.name,
    optionalDepends: [],
    priorityInit: application.priorityInit,
    services: application.services,
  });
};

/**
 * Seed a {@link DigitalAlchemyModule} from an existing
 * {@link LibraryDefinition}.
 *
 * @remarks
 * Mirrors `fromApplication` but for library definitions, preserving
 * `optionalDepends` which applications do not carry.
 */
// #MARK: fromLibrary
createModule.fromLibrary = <S extends ServiceMap, C extends OptionalModuleConfiguration>(
  library: LibraryDefinition<S, C>,
) => {
  return createModule<S, C>({
    configuration: library.configuration,
    depends: library.depends,
    name: library.name,
    optionalDepends: library.optionalDepends,
    priorityInit: library.priorityInit,
    services: library.services,
  });
};
