import { Except, Merge } from "type-fest";

import { CreateApplication } from "../services";
import { iTestRunner, TestRunner } from "../testing";
import { OptionalModuleConfiguration } from "./config.helper";
import { deepExtend } from "./extend.helper";
import {
  ApplicationDefinition,
  CreateLibrary,
  LibraryDefinition,
  ServiceFunction,
  ServiceMap,
  TLibrary,
} from "./wiring.helper";

export type ExtendOptions = {
  name?: string;
  /**
   * default: true
   */
  keepConfiguration?: boolean;
};

export type DigitalAlchemyModule<S extends ServiceMap, C extends OptionalModuleConfiguration> = {
  services: S;
  configuration: C;
  name: string;
  depends: TLibrary[];
  optionalDepends?: TLibrary[];
  priorityInit: string[];
  extend: (options?: ExtendOptions) => ModuleExtension<S, C>;
};

export type CreateModuleOptions<S extends ServiceMap, C extends OptionalModuleConfiguration> = {
  services: S;
  configuration: C;
  name: string;
  depends: TLibrary[];
  optionalDepends?: TLibrary[];
  priorityInit: string[];
};

/**
 * commands mutate module
 */
export type ModuleExtension<S extends ServiceMap, C extends OptionalModuleConfiguration> = {
  appendLibrary: (library: TLibrary) => ModuleExtension<S, C>;
  appendService: (name: string, target: ServiceFunction) => ModuleExtension<S, C>;

  /**
   * name must match existing library
   */
  replaceLibrary: (library: TLibrary) => ModuleExtension<S, C>;

  /**
   * name must match existing service
   */
  replaceService: <TARGET extends keyof S, FN extends ServiceFunction>(
    name: TARGET,
    target: FN,
  ) => ModuleExtension<Merge<S, { [key in TARGET]: FN }>, C>;

  /**
   * throws if any service does not exist
   */
  pickService: <PICK extends keyof S>(...services: PICK[]) => ModuleExtension<Pick<S, PICK>, C>;

  /**
   * throws if any service does not exist
   */
  omitService: <OMIT extends keyof S>(...services: OMIT[]) => ModuleExtension<Except<S, OMIT>, C>;

  /**
   * build api compatible replacement (potentially adding)
   */
  rebuild: <REPLACEMENTS extends S>(
    services: Partial<REPLACEMENTS>,
  ) => ModuleExtension<REPLACEMENTS, C>;

  /**
   * export as application
   */
  toApplication: () => ApplicationDefinition<S, C>;

  /**
   * export as library
   */
  toLibrary: () => LibraryDefinition<S, C>;

  /**
   * export as test
   */
  toTest: () => iTestRunner<S, C>;
};

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
          throw new Error(`${name} already is appended`);
        }
        const exists = workingModule.depends.some(i => i.name === name);
        if (exists) {
          throw new Error(`${name} exists as a library in base, use replaceLibrary`);
        }
        appendLibrary.set(name, library);
        return extend;
      },
      appendService: (name: string, service: ServiceFunction) => {
        if (name in services) {
          throw new Error(`${name} exists as a service in base, use replaceService`);
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
          appendLibrary.set(name, library);
        } else {
          const exists = workingModule.depends.some(i => i.name === name);
          if (!exists) {
            throw new Error(`${name} does not exist in module yet`);
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
          throw new Error(`${String(name)} does not exist to replace`);
        }
        // @ts-expect-error I don't care
        services[name] = target;
        return extend;
      },
      toApplication: () => {
        const depends = {} as Record<string, TLibrary>;
        workingModule.depends.forEach(i => (depends[i.name] = i));
        appendLibrary.forEach((value, key) => (depends[key] = value));

        return CreateApplication({
          configuration: deepExtend({}, workingModule.configuration),
          libraries: Object.values(depends),
          // @ts-expect-error wrapper problems
          name: extendOptions?.name || options.name,
          // @ts-expect-error wrapper problems
          priorityInit: [...workingModule.priorityInit],
          services,
        });
      },
      toLibrary: () => {
        const depends = {} as Record<string, TLibrary>;
        workingModule.depends.forEach(i => (depends[i.name] = i));
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

createModule.fromApplication = <S extends ServiceMap, C extends OptionalModuleConfiguration>(
  application: ApplicationDefinition<S, C>,
) => {
  return createModule<S, C>({
    configuration: application.configuration || ({} as C),
    depends: application.libraries || [],
    name: application.name,
    optionalDepends: [],
    priorityInit: application.priorityInit || [],
    services: application.services,
  });
};

createModule.fromLibrary = <S extends ServiceMap, C extends OptionalModuleConfiguration>(
  library: LibraryDefinition<S, C>,
) => {
  return createModule<S, C>({
    configuration: library.configuration || ({} as C),
    depends: library.depends || [],
    name: library.name,
    optionalDepends: library.optionalDepends || [],
    priorityInit: library.priorityInit || [],
    services: library.services,
  });
};
