import type {
  ConfigInputTypes,
  ConfigTypes,
  LibraryDefinition,
  ModuleConfiguration,
  PartialConfiguration,
  ServiceMap,
  TGetConfig,
  TServiceParams,
} from "@digital-alchemy/core";

const STRICT_SCHEMA = {
  "~standard": {
    vendor: "strict-consumer",
    version: 1 as const,
    types: {} as { readonly input: string; readonly output: number },
    validate(value: unknown) {
      return { value: Number(value) };
    },
  },
};

type StrictConfiguration = { VALUE: { schema: typeof STRICT_SCHEMA } };
type StrictInput = ConfigInputTypes<StrictConfiguration>;
type StrictOutput = ConfigTypes<StrictConfiguration>;

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type ExpectTrue<T extends true> = T;

export type _StrictSchemaInputIsString = ExpectTrue<Equal<StrictInput["VALUE"], string>>;
export type _StrictSchemaOutputIsNumber = ExpectTrue<Equal<StrictOutput["VALUE"], number>>;

const UNKNOWN_OUTPUT_SCHEMA = {
  "~standard": {
    vendor: "unknown-output",
    version: 1 as const,
    validate(value: unknown) {
      return { value };
    },
  },
};
type UnknownOutput = ConfigTypes<{ VALUE: { schema: typeof UNKNOWN_OUTPUT_SCHEMA } }>;
export type _ExplicitUnknownOutputRemainsUnknown = ExpectTrue<
  Equal<UnknownOutput["VALUE"], unknown>
>;

type LegacyValue = boolean | number | object | string;
type IsAny<T> = 0 extends 1 & T ? true : false;
type LegacyCompatible<T> = IsAny<T> extends true
  ? false
  : [T] extends [LegacyValue]
    ? [LegacyValue] extends [T]
      ? true
      : false
    : false;
type BROAD_LIBRARY = LibraryDefinition<ServiceMap, ModuleConfiguration>;

declare module "@digital-alchemy/core" {
  interface LoadedModules {
    broad_legacy: BROAD_LIBRARY;
  }
}

declare const broadGetter: TGetConfig<BROAD_LIBRARY>;
const broadValue = broadGetter("ANY_KEY");
type BroadServiceValue = TServiceParams["config"]["broad_legacy"]["ANY_KEY"];
type BroadPartialValue = NonNullable<
  NonNullable<PartialConfiguration["broad_legacy"]>["ANY_KEY"]
>;

export type _WidenedConfigTypesKeepLegacy = ExpectTrue<
  LegacyCompatible<ConfigTypes<ModuleConfiguration>["ANY_KEY"]>
>;
export type _WidenedGetterKeepsLegacy = ExpectTrue<LegacyCompatible<typeof broadValue>>;
export type _WidenedServiceConfigKeepsLegacy = ExpectTrue<LegacyCompatible<BroadServiceValue>>;
export type _WidenedPartialConfigurationKeepsLegacy = ExpectTrue<LegacyCompatible<BroadPartialValue>>;

const encoded: StrictInput["VALUE"] = "7";
const decoded: StrictOutput["VALUE"] = 7;
void encoded;
void decoded;
