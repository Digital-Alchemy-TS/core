import { Type } from "typebox";
import { Format } from "typebox/format";
import type * as TypeBoxValue from "typebox/value";
import { z } from "zod";

import type {
  ApplicationDefinition,
  BootstrapOptions,
  ConfigInputTypes,
  ConfigTypes,
  InternalConfig,
  LibraryDefinition,
  OptionalModuleConfiguration,
  RecordConfig,
  SchemaConfig,
  ServiceMap,
  StringConfig,
  TContext,
  TGetConfig,
  TServiceParams,
} from "../src/index.mts";
import * as Core from "../src/index.mts";
import {
  BootstrapException,
  classifyTypeBoxPeerFailure,
  CreateLibrary,
  createModule,
  INJECTED_DEFINITIONS,
  TestRunner,
} from "../src/index.mts";

const PREPARATION_LOCATION = {
  context: "test:preparation" as TContext,
  project: "schema_preparation",
  property: "VALUE",
};

// ─── Local compile-time assertions ────────────────────────────────────────────

type TypeEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type ExpectTrue<T extends true> = T;

const CODEC_SCHEMA = Type.Codec(Type.String())
  .Decode(value => Number(value))
  .Encode(value => String(value));
const TYPEBOX_OPTIONAL_SCHEMA = Type.Optional(Type.String());
const ZOD_TRANSFORM_SCHEMA = z.string().transform(value => value.length);

const UNKNOWN_OUTPUT_SCHEMA = {
  "~standard": {
    vendor: "unknown-output",
    version: 1 as const,
    validate(value: unknown) {
      return { value };
    },
  },
};
type ExplicitUnknownOutput = ConfigTypes<{
  VALUE: { schema: typeof UNKNOWN_OUTPUT_SCHEMA };
}>;
export type _ExplicitUnknownOutputRemainsUnknown = ExpectTrue<
  TypeEqual<ExplicitUnknownOutput["VALUE"], unknown>
>;

const TYPEBOX_TYPED_LIBRARY = CreateLibrary({
  configuration: {
    CODEC: { schema: CODEC_SCHEMA },
  },
  // @ts-expect-error local fixture name is not declaration-merged
  name: "schema_typed",
  services: {},
});

const ZOD_TYPED_LIBRARY = CreateLibrary({
  configuration: {
    VALUE: { schema: ZOD_TRANSFORM_SCHEMA },
  },
  // @ts-expect-error local fixture name is not declaration-merged
  name: "schema_zod_typed",
  services: {},
});

const LEGACY_ENUM_CONFIG: StringConfig<"trace" | "debug"> = {
  default: "trace",
  enum: ["trace", "debug"],
  type: "string",
};
const LEGACY_RECORD_CONFIG: RecordConfig = {
  default: { retries: "1" },
  type: "record",
};
const LEGACY_INTERNAL_CONFIG: InternalConfig<{ enabled: boolean }> = {
  default: { enabled: true },
  type: "internal",
};
const LEGACY_TYPED_LIBRARY = CreateLibrary({
  configuration: {
    ENUM: LEGACY_ENUM_CONFIG,
    INTERNAL: LEGACY_INTERNAL_CONFIG,
    RECORD: LEGACY_RECORD_CONFIG,
  },
  // @ts-expect-error local fixture name is not declaration-merged
  name: "schema_legacy_types",
  services: {},
});

type TypeBoxTypedInput = ConfigInputTypes<typeof TYPEBOX_TYPED_LIBRARY.configuration>;
type TypeBoxTypedOutput = ConfigTypes<typeof TYPEBOX_TYPED_LIBRARY.configuration>;
type ZodTypedInput = ConfigInputTypes<typeof ZOD_TYPED_LIBRARY.configuration>;
type ZodTypedOutput = ConfigTypes<typeof ZOD_TYPED_LIBRARY.configuration>;

export type _CodecInputIsEncodedString = ExpectTrue<TypeEqual<TypeBoxTypedInput["CODEC"], string>>;
export type _CodecOutputIsDecodedNumber = ExpectTrue<
  TypeEqual<TypeBoxTypedOutput["CODEC"], number>
>;
type TypeBoxOptionalConfiguration = { VALUE: { schema: typeof TYPEBOX_OPTIONAL_SCHEMA } };
type TypeBoxOptionalInput = ConfigInputTypes<TypeBoxOptionalConfiguration>;
type TypeBoxOptionalOutput = ConfigTypes<TypeBoxOptionalConfiguration>;
export type _TypeBoxOptionalInputAllowsUndefined = ExpectTrue<
  TypeEqual<TypeBoxOptionalInput["VALUE"], string | undefined>
>;
export type _TypeBoxOptionalOutputAllowsUndefined = ExpectTrue<
  TypeEqual<TypeBoxOptionalOutput["VALUE"], string | undefined>
>;
type SchemaEntryWithRequired = { schema: typeof TYPEBOX_OPTIONAL_SCHEMA; required: false };
export type _SchemaRequiredIsRejected = ExpectTrue<
  TypeEqual<SchemaEntryWithRequired extends SchemaConfig ? true : false, false>
>;
export type _ZodInputIsString = ExpectTrue<TypeEqual<ZodTypedInput["VALUE"], string>>;
export type _ZodOutputIsNumber = ExpectTrue<TypeEqual<ZodTypedOutput["VALUE"], number>>;
type LegacyTypedOutput = ConfigTypes<typeof LEGACY_TYPED_LIBRARY.configuration>;
type LegacyTypedInput = ConfigInputTypes<typeof LEGACY_TYPED_LIBRARY.configuration>;
export type _LegacyEnumPreservesLiterals = ExpectTrue<
  TypeEqual<LegacyTypedOutput["ENUM"], "trace" | "debug">
>;
export type _LegacyRecordPreservesValue = ExpectTrue<
  TypeEqual<LegacyTypedOutput["RECORD"], Record<string, string>>
>;
export type _LegacyInternalPreservesShape = ExpectTrue<
  TypeEqual<LegacyTypedOutput["INTERNAL"], { enabled: boolean }>
>;
export type _LegacyInputMatchesOutput = ExpectTrue<
  TypeEqual<LegacyTypedInput["ENUM"], "trace" | "debug">
>;
const LEGACY_GET_CONFIG = (() => "trace" as "trace" | "debug") as TGetConfig<
  typeof LEGACY_TYPED_LIBRARY
>;
const LEGACY_GETTER_VALUE = LEGACY_GET_CONFIG("ENUM");
export type _TGetConfigPreservesEnum = ExpectTrue<
  TypeEqual<typeof LEGACY_GETTER_VALUE, "trace" | "debug">
>;
export const LEGACY_BOOTSTRAP_OPTIONS: BootstrapOptions = {
  configuration: { boilerplate: { LOG_LEVEL: "silent" } },
};

function asApplication(
  target: LibraryDefinition<ServiceMap, OptionalModuleConfiguration>,
): ApplicationDefinition<ServiceMap, OptionalModuleConfiguration> {
  return createModule.fromLibrary(target).extend().toApplication();
}

async function runAndTeardown(
  target: LibraryDefinition<ServiceMap, OptionalModuleConfiguration>,
  callback: (params: TServiceParams) => void,
) {
  const app = await TestRunner({ target }).run(callback);
  await app.teardown();
}

describe("schema-backed configuration", () => {
  afterEach(() => {
    delete process.env.SCHEMA_LEGACY_VALUE;
    delete process.env.SCHEMA_LOSING_VALUE;
    delete process.env.SCHEMA_SOURCE_VALUE;
    delete process.env.SCHEMA_SOURCE_VETO_VALUE;
    delete process.env.SCHEMA_WINNING_VALUE;
    delete process.env.SCHEMA_CONTAINERS_RECORD;
    delete process.env.SCHEMA_CONTAINERS_OBJECT;
    delete process.env.SCHEMA_CONTAINERS_TEXT;
    delete process.env.SCHEMA_CONTAINERS_CODEC_TEXT;
    delete process.env.SCHEMA_CONTAINER_BAD_VALUE;
    delete process.env.SCHEMA_CONTAINER_LOSING_VALUE;
    vi.restoreAllMocks();
  });

  it("uses native TypeBox defaults and nested coercion after source resolution", async () => {
    expect.assertions(2);
    const library = CreateLibrary({
      configuration: {
        DEFAULTED: { schema: Type.Number({ default: 3 }) },
        NESTED: {
          schema: Type.Object({
            count: Type.Number(),
            enabled: Type.Boolean(),
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_native",
      services: {},
    });

    const app = await TestRunner({ target: library })
      .configure({
        schema_native: {
          NESTED: { count: "7", enabled: "true" } as never,
        },
      })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_native.DEFAULTED).toBe(3);
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_native.NESTED).toEqual({ count: 7, enabled: true });
        });
      });
    await app.teardown();
  });

  it("prepares TypeBox root defaults before service construction", async () => {
    expect.assertions(6);
    let schemaDefaultCalls = 0;
    let observedSchemaValue: unknown;
    let observedLegacyValue: unknown;
    let timeoutSignal: AbortSignal | undefined;
    const library = CreateLibrary({
      configuration: {
        SCHEMA: {
          schema: Type.Integer({
            default: () => {
              schemaDefaultCalls += 1;
              return 5000;
            },
          }),
        },
        LEGACY: { default: 5000, type: "number" },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_construction_defaults",
      services: {
        inspect({ config }) {
          const current = config as unknown as {
            schema_construction_defaults: { SCHEMA: number; LEGACY: number };
          };
          observedSchemaValue = current.schema_construction_defaults.SCHEMA;
          observedLegacyValue = current.schema_construction_defaults.LEGACY;
          timeoutSignal = AbortSignal.timeout(current.schema_construction_defaults.SCHEMA);
        },
      },
    });
    const app = await TestRunner({ target: library }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        const current = config as unknown as {
          schema_construction_defaults: { SCHEMA: number; LEGACY: number };
        };
        expect(current.schema_construction_defaults.SCHEMA).toBe(5000);
        expect(current.schema_construction_defaults.LEGACY).toBe(5000);
      });
    });
    expect(observedSchemaValue).toBe(5000);
    expect(observedLegacyValue).toBe(5000);
    expect(timeoutSignal).toBeInstanceOf(AbortSignal);
    expect(schemaDefaultCalls).toBe(1);
    await app.teardown();
  });

  it("accepts native cyclic schemas and coerces nested values", async () => {
    expect.assertions(1);
    const schema = Type.Cyclic(
      {
        Node: Type.Object({ value: Type.Number() }),
      },
      "Node",
    );
    const library = CreateLibrary({
      configuration: { VALUE: { schema } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_cyclic",
      services: {},
    });

    const app = await TestRunner({ target: library })
      .configure({ schema_cyclic: { VALUE: { value: "7" } } as never })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_cyclic.VALUE).toEqual({ value: 7 });
        });
      });
    await app.teardown();
  });

  it("rejects a native invalid default without manufacturing a valid value", async () => {
    expect.assertions(1);
    const library = CreateLibrary({
      configuration: { VALUE: { schema: Type.Number({ default: "not-a-number" }) } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_invalid_default",
      services: {},
    });

    await expect(TestRunner({ target: library }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_INVALID",
    });
  });

  it("caches root default values and deferred preparation failures", async () => {
    expect.assertions(7);
    let valueCalls = 0;
    let receiverIsSchema = false;
    let valueSchema: unknown;
    valueSchema = Type.Number({
      default: function (this: unknown) {
        valueCalls += 1;
        receiverIsSchema = this === valueSchema;
        return 7;
      },
    });
    const valueLibrary = CreateLibrary({
      configuration: { VALUE: { schema: valueSchema as never } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_default_value",
      services: {},
    });
    const valueApp = await TestRunner({ target: valueLibrary }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        const current = config as unknown as { schema_default_value: { VALUE: number } };
        expect(current.schema_default_value.VALUE).toBe(7);
      });
    });
    expect(valueCalls).toBe(1);
    expect(receiverIsSchema).toBe(true);
    await valueApp.teardown();

    let undefinedCalls = 0;
    const undefinedLibrary = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Optional(
            Type.String({
              default: (() => {
                undefinedCalls += 1;
                return undefined as unknown;
              }) as never,
            }),
          ),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_default_undefined",
      services: {},
    });
    const undefinedApp = await TestRunner({ target: undefinedLibrary }).run(
      ({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          const current = config as unknown as { schema_default_undefined: { VALUE: undefined } };
          expect(current.schema_default_undefined.VALUE).toBeUndefined();
        });
      },
    );
    expect(undefinedCalls).toBe(1);
    await undefinedApp.teardown();

    let failureCalls = 0;
    const failureLibrary = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Number({
            default: () => {
              failureCalls += 1;
              throw new Error("secret default failure");
            },
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_default_failure",
      services: {
        register({ internal }) {
          internal.config.registerLoader(
            async () => ({ schema_default_failure: { VALUE: 9 } }) as never,
            "custom_default_failure" as never,
          );
        },
      },
    });
    const failureApp = await TestRunner({ target: failureLibrary }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        const current = config as unknown as { schema_default_failure: { VALUE: number } };
        expect(current.schema_default_failure.VALUE).toBe(9);
      });
    });
    expect(failureCalls).toBe(1);
    await failureApp.teardown();
  });

  it("returns undefined without provider work for non-value preparations", async () => {
    expect.assertions(3);
    expect(
      await Core.clonePreparedTypeBoxValue({ kind: "unprepared" }, PREPARATION_LOCATION),
    ).toBeUndefined();
    expect(
      await Core.clonePreparedTypeBoxValue({ kind: "undefined" }, PREPARATION_LOCATION),
    ).toBeUndefined();
    expect(
      await Core.clonePreparedTypeBoxValue(
        {
          error: new BootstrapException(
            PREPARATION_LOCATION.context,
            "CONFIG_SCHEMA_PROCESSING_FAILED",
            "cached failure",
          ),
          kind: "failure",
        },
        PREPARATION_LOCATION,
      ),
    ).toBeUndefined();
  });

  it("fails an unsuperseded root preparation failure with sanitized diagnostics", async () => {
    expect.assertions(4);
    const secret = "secret-default-preparation";
    let factoryCalls = 0;
    const library = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Number({
            default: () => {
              factoryCalls += 1;
              throw new Error(secret);
            },
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_default_unrescued",
      services: {},
    });

    const error = await TestRunner({ target: library })
      .run(() => {})
      .catch(value => value);
    expect(error).toBeInstanceOf(BootstrapException);
    expect((error as BootstrapException).cause).toBe("CONFIG_SCHEMA_PROCESSING_FAILED");
    expect((error as BootstrapException).message).not.toContain(secret);
    expect(factoryCalls).toBe(1);
  });

  it("reuses a prepared root default for an explicit undefined bootstrap value", async () => {
    expect.assertions(4);
    let factoryCalls = 0;
    let constructionValue: unknown;
    const library = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Number({
            default: () => {
              factoryCalls += 1;
              return 7;
            },
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_default_undefined_bootstrap",
      services: {
        inspect({ config }) {
          const current = config as unknown as {
            schema_default_undefined_bootstrap: { VALUE: number };
          };
          constructionValue = current.schema_default_undefined_bootstrap.VALUE;
        },
      },
    });
    const app = await TestRunner({ target: library })
      .setOptions({
        configuration: {
          schema_default_undefined_bootstrap: { VALUE: undefined },
        } as never,
      })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          const current = config as unknown as {
            schema_default_undefined_bootstrap: { VALUE: number };
          };
          expect(current.schema_default_undefined_bootstrap.VALUE).toBe(7);
        });
      });
    expect(constructionValue).toBe(7);
    expect(factoryCalls).toBe(1);
    expect(app.booted).toBe(true);
    await app.teardown();
  });

  it("sanitizes an unusable TypeBox clone during undefined-root suppression", async () => {
    expect.assertions(2);
    vi.doMock("typebox/value", async () => ({
      ...(await vi.importActual<typeof TypeBoxValue>("typebox/value")),
      Clone: (): undefined => undefined,
    }));

    try {
      const error = await Core.processTypeBoxValue(
        Type.Optional(Type.String()),
        undefined,
        PREPARATION_LOCATION,
        { kind: "undefined" },
      ).catch(value => value);
      expect(error).toBeInstanceOf(BootstrapException);
      expect((error as BootstrapException).cause).toBe("CONFIG_SCHEMA_PROCESSING_FAILED");
    } finally {
      vi.doUnmock("typebox/value");
    }
  });

  it("sanitizes a raw TypeBox module failure during default preparation", async () => {
    expect.assertions(4);
    const secret = "secret-typebox-module";
    vi.doMock("typebox/value", async () => {
      const actual = await vi.importActual<typeof TypeBoxValue>("typebox/value");
      return new Proxy(actual, {
        get(target, property, receiver) {
          if (property === "Clone") {
            throw new Error(secret);
          }
          return Reflect.get(target, property, receiver);
        },
      });
    });

    try {
      const prepared = await Core.prepareTypeBoxDefault(
        Type.Number({ default: 7 }),
        PREPARATION_LOCATION,
      );
      expect(prepared.kind).toBe("failure");
      if (prepared.kind !== "failure") {
        return;
      }
      expect(prepared.error).toBeInstanceOf(BootstrapException);
      expect(prepared.error.cause).toBe("CONFIG_SCHEMA_PROCESSING_FAILED");
      expect(prepared.error.message).not.toContain(secret);
    } finally {
      vi.doUnmock("typebox/value");
    }
  });

  it("defers a raw preview-clone failure until a later source rescues it", async () => {
    expect.assertions(3);
    const secret = "secret-preview-clone";
    const cloneSpy = vi
      .spyOn(Core, "clonePreparedTypeBoxValue")
      .mockRejectedValue(new Error(secret));
    let factoryCalls = 0;
    const library = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Number({
            default: () => {
              factoryCalls += 1;
              return 7;
            },
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_preview_clone_rescue",
      services: {
        register({ internal }) {
          internal.config.registerLoader(
            async () => ({ schema_preview_clone_rescue: { VALUE: 9 } }) as never,
            "custom_preview_clone_rescue" as never,
          );
        },
      },
    });
    const app = await TestRunner({ target: library }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        const current = config as unknown as { schema_preview_clone_rescue: { VALUE: number } };
        expect(current.schema_preview_clone_rescue.VALUE).toBe(9);
      });
    });
    expect(cloneSpy).toHaveBeenCalledTimes(1);
    expect(factoryCalls).toBe(1);
    await app.teardown();
  });

  it("preserves a safe preview-clone failure when no source rescues it", async () => {
    expect.assertions(4);
    const failure = new BootstrapException(
      PREPARATION_LOCATION.context,
      "CONFIG_SCHEMA_PROCESSING_FAILED",
      "preview clone failed",
    );
    const cloneSpy = vi.spyOn(Core, "clonePreparedTypeBoxValue").mockRejectedValue(failure);
    let factoryCalls = 0;
    const library = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Number({
            default: () => {
              factoryCalls += 1;
              return 7;
            },
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_preview_clone_unrescued",
      services: {},
    });
    const error = await TestRunner({ target: library })
      .run(() => {})
      .catch(value => value);
    expect(error).toBe(failure);
    expect(cloneSpy).toHaveBeenCalledTimes(1);
    expect(factoryCalls).toBe(1);
    expect((error as BootstrapException).cause).toBe("CONFIG_SCHEMA_PROCESSING_FAILED");
  });

  it("keeps a defined bootstrap value from evaluating a TypeBox root factory", async () => {
    expect.assertions(2);
    let calls = 0;
    const library = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Number({
            default: () => {
              calls += 1;
              return 5;
            },
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_default_bootstrap",
      services: {},
    });
    const app = await TestRunner({ target: library })
      .setOptions({
        configuration: { schema_default_bootstrap: { VALUE: 9 } } as never,
      })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          const current = config as unknown as { schema_default_bootstrap: { VALUE: number } };
          expect(current.schema_default_bootstrap.VALUE).toBe(9);
        });
      });
    expect(calls).toBe(0);
    await app.teardown();
  });

  it("defers nested default factories until finalization after replacement", async () => {
    expect.assertions(3);
    let rootCalls = 0;
    let nestedCalls = 0;
    const library = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Object(
            {
              nested: Type.Number({
                default: () => {
                  nestedCalls += 1;
                  return 7;
                },
              }),
            },
            {
              default: () => {
                rootCalls += 1;
                return { nested: 1 };
              },
            },
          ),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_nested_replacement",
      services: {
        replace({ internal }) {
          internal.config.registerLoader(
            async () => ({ schema_nested_replacement: { VALUE: {} } }) as never,
            "custom_nested_replacement" as never,
          );
        },
      },
    });
    const app = await TestRunner({ target: library }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        const current = config as unknown as {
          schema_nested_replacement: { VALUE: { nested: number } };
        };
        expect(current.schema_nested_replacement.VALUE).toEqual({ nested: 7 });
      });
    });
    expect(rootCalls).toBe(1);
    expect(nestedCalls).toBe(1);
    await app.teardown();
  });

  it("isolates mutable TypeBox root defaults from live previews", async () => {
    expect.assertions(2);
    let calls = 0;
    const library = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Object(
            { items: Type.Array(Type.Number()) },
            {
              default: () => {
                calls += 1;
                return { items: [1] };
              },
            },
          ),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_mutable_default",
      services: {
        mutate({ internal }) {
          const preview = internal.boilerplate.configuration[INJECTED_DEFINITIONS] as unknown as {
            schema_mutable_default: { VALUE: { items: number[] } };
          };
          preview.schema_mutable_default.VALUE.items.push(2);
        },
      },
    });
    const app = await TestRunner({ target: library }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        const current = config as unknown as {
          schema_mutable_default: { VALUE: { items: number[] } };
        };
        expect(current.schema_mutable_default.VALUE).toEqual({ items: [1] });
      });
    });
    expect(calls).toBe(1);
    await app.teardown();
  });

  it("runs TypeBox codec callbacks once and injects decoded output", async () => {
    expect.assertions(2);
    let decodeCount = 0;
    const schema = Type.Codec(Type.String())
      .Decode(value => {
        decodeCount += 1;
        return Number(value);
      })
      .Encode(value => String(value));
    const library = CreateLibrary({
      configuration: { VALUE: { schema } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_codec",
      services: {},
    });

    await TestRunner({ target: library })
      .configure({ schema_codec: { VALUE: "42" } })
      .run(async ({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_codec.VALUE).toBe(42);
          expect(decodeCount).toBe(1);
        });
      })
      .then(app => app.teardown());
  });

  it("supports mixed providers in one module", async () => {
    expect.assertions(3);
    const standard = {
      "~standard": {
        vendor: "mixed-fixture",
        version: 1 as const,
        validate(value: unknown) {
          return { value: String(value).trim() };
        },
      },
    };
    const library = CreateLibrary({
      configuration: {
        NUMBER: { schema: Type.Number({ default: 4 }) },
        TEXT: { schema: z.string().transform(value => value.toUpperCase()) },
        STANDARD: { schema: standard },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_mixed",
      services: {},
    });

    const app = await TestRunner({ target: library })
      .configure({ schema_mixed: { TEXT: "hello", STANDARD: "  world  " } })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_mixed.NUMBER).toBe(4);
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_mixed.TEXT).toBe("HELLO");
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_mixed.STANDARD).toBe("world");
        });
      });
    await app.teardown();
  });

  it("uses Zod native async parsing once for transforms and preserves defaults", async () => {
    expect.assertions(5);
    let transformCount = 0;
    const asyncSchema = z.string().transform(async value => {
      transformCount += 1;
      return value.toUpperCase();
    });
    const library = CreateLibrary({
      configuration: {
        ASYNC: { schema: asyncSchema },
        DEFAULTED: { schema: z.string().default("native") },
        OPTIONAL: { schema: z.string().optional() },
        PREFAULT: { schema: z.string().prefault("native") },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_zod_native",
      services: {},
    });

    const app = await TestRunner({ target: library })
      .configure({ schema_zod_native: { ASYNC: "hello" } })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_zod_native.ASYNC).toBe("HELLO");
          expect(transformCount).toBe(1);
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_zod_native.DEFAULTED).toBe("native");
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_zod_native.OPTIONAL).toBeUndefined();
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_zod_native.PREFAULT).toBe("native");
        });
      });
    await app.teardown();
  });

  it("calls a generic Standard Schema validator once and keeps transformed output", async () => {
    expect.assertions(2);
    let calls = 0;
    const schema = {
      "~standard": {
        vendor: "fixture",
        version: 1 as const,
        types: {} as { input: string; output: number },
        validate(value: unknown) {
          calls += 1;
          return { value: Number(value) };
        },
      },
    };
    const library = CreateLibrary({
      configuration: { VALUE: { schema } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_standard",
      services: {},
    });

    await TestRunner({ target: library })
      .configure({ schema_standard: { VALUE: "9" } })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_standard.VALUE).toBe(9);
          expect(calls).toBe(1);
        });
      })
      .then(app => app.teardown());
  });

  it("preserves native Standard Schema undefined output and issue failures", async () => {
    expect.assertions(3);
    let undefinedCalls = 0;
    const undefinedSchema = {
      "~standard": {
        vendor: "undefined-fixture",
        version: 1 as const,
        validate() {
          undefinedCalls += 1;
          return { value: undefined as undefined };
        },
      },
    };
    const optional = CreateLibrary({
      configuration: { VALUE: { schema: undefinedSchema } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_standard_undefined",
      services: {},
    });
    const optionalApp = await TestRunner({ target: optional }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        // @ts-expect-error local fixture name is not declaration-merged
        expect(config.schema_standard_undefined.VALUE).toBeUndefined();
      });
    });
    expect(undefinedCalls).toBe(1);
    await optionalApp.teardown();

    const issues = CreateLibrary({
      configuration: {
        VALUE: {
          schema: {
            "~standard": {
              vendor: "issues-fixture",
              version: 1 as const,
              validate() {
                return { issues: [{ message: "invalid" }] };
              },
            },
          },
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_standard_issues",
      services: {},
    });
    await expect(TestRunner({ target: issues }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_INVALID",
    });
  });

  it("preserves source precedence for losing invalid values and rejects winning invalid values", async () => {
    expect.assertions(3);
    process.env.SCHEMA_LOSING_VALUE = "not-a-number";
    const losing = CreateLibrary({
      configuration: {
        VALUE: { schema: Type.Number() },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_losing",
      services: {
        registerLoader({ internal }) {
          internal.config.registerLoader(
            async () => ({ schema_losing: { VALUE: 12 } }) as never,
            "custom_losing" as never,
          );
        },
      },
    });
    const losingApp = await TestRunner({ target: losing })
      .setOptions({
        loadConfigs: true,
        configuration: { schema_losing: { VALUE: 12 } },
      })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_losing.VALUE).toBe(12);
        });
      });
    await losingApp.teardown();

    process.env.SCHEMA_SOURCE_VETO_VALUE = "not-a-number";
    const veto = CreateLibrary({
      configuration: {
        VALUE: { schema: Type.Number(), source: ["argv"] },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_source_veto",
      services: {},
    });
    const vetoApp = await TestRunner({ target: veto })
      .setOptions({
        loadConfigs: true,
        configuration: { schema_source_veto: { VALUE: 12 } },
      })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_source_veto.VALUE).toBe(12);
        });
      });
    await vetoApp.teardown();

    process.env.SCHEMA_WINNING_VALUE = "not-a-number";
    const winning = CreateLibrary({
      configuration: {
        VALUE: { schema: Type.Number(), source: ["env"] },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_winning",
      services: {},
    });
    await expect(
      TestRunner({ target: winning })
        .setOptions({ loadConfigs: true })
        .run(() => {}),
    ).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_INVALID",
    });
  });

  it("publishes legacy loader values to later custom loaders", async () => {
    expect.assertions(4);
    process.env.SCHEMA_LEGACY_VALUE = "from-env";
    const seen: string[] = [];
    const preInit: string[] = [];
    const library = CreateLibrary({
      configuration: {
        VALUE: { default: "default", type: "string" },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_legacy",
      services: {
        registerLoaders({ internal, lifecycle }) {
          internal.config.merge({ schema_legacy: { VALUE: "from-merge" } } as never);
          lifecycle.onPreInit(() => {
            const current = internal.boilerplate.configuration[INJECTED_DEFINITIONS] as unknown as {
              schema_legacy: { VALUE: string };
            };
            preInit.push(current.schema_legacy.VALUE);
          });
          internal.config.registerLoader(async ({ internal: loaderInternal }) => {
            const current = loaderInternal.boilerplate.configuration[
              INJECTED_DEFINITIONS
            ] as unknown as { schema_legacy: { VALUE: string } };
            const value = current.schema_legacy.VALUE;
            seen.push(value);
            return { schema_legacy: { VALUE: `${value}-A` } } as never;
          }, "custom_a" as never);
          internal.config.registerLoader(async ({ internal: loaderInternal }) => {
            const current = loaderInternal.boilerplate.configuration[
              INJECTED_DEFINITIONS
            ] as unknown as { schema_legacy: { VALUE: string } };
            const value = current.schema_legacy.VALUE;
            seen.push(value);
            return { schema_legacy: { VALUE: `${value}-B` } } as never;
          }, "custom_b" as never);
        },
      },
    });
    const app = await TestRunner({ target: library })
      .setOptions({ loadConfigs: true })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_legacy.VALUE).toBe("from-env-A-B");
        });
      });
    expect(seen).toEqual(["from-env", "from-env-A"]);
    expect(preInit).toEqual(["from-merge"]);
    expect(app.booted).toBe(true);
    await app.teardown();
  });

  it("publishes raw schema previews to later custom loaders", async () => {
    expect.assertions(4);
    const seen: unknown[][] = [];
    let zodTransforms = 0;
    const library = CreateLibrary({
      configuration: {
        TYPEBOX: { schema: Type.Number({ default: 3 }) },
        ZOD: {
          schema: z.string().transform(value => {
            zodTransforms += 1;
            return value.toUpperCase();
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_raw_visibility",
      services: {
        register({ internal }) {
          internal.config.registerLoader(async ({ internal: loaderInternal }) => {
            const current = loaderInternal.boilerplate.configuration[
              INJECTED_DEFINITIONS
            ] as unknown as { schema_raw_visibility: { TYPEBOX: unknown; ZOD: unknown } };
            seen.push([current.schema_raw_visibility.TYPEBOX, current.schema_raw_visibility.ZOD]);
            return {
              schema_raw_visibility: { TYPEBOX: "4", ZOD: "loader" },
            } as never;
          }, "custom_raw_visibility_a" as never);
          internal.config.registerLoader(async ({ internal: loaderInternal }) => {
            const current = loaderInternal.boilerplate.configuration[
              INJECTED_DEFINITIONS
            ] as unknown as { schema_raw_visibility: { TYPEBOX: unknown; ZOD: unknown } };
            seen.push([current.schema_raw_visibility.TYPEBOX, current.schema_raw_visibility.ZOD]);
            return {
              schema_raw_visibility: { TYPEBOX: "5", ZOD: "final" },
            } as never;
          }, "custom_raw_visibility_b" as never);
        },
      },
    });
    const app = await TestRunner({ target: library })
      .setOptions({
        configuration: { schema_raw_visibility: { ZOD: "bootstrap" } } as never,
      })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          const current = config as unknown as {
            schema_raw_visibility: { TYPEBOX: number; ZOD: string };
          };
          expect(current.schema_raw_visibility.TYPEBOX).toBe(5);
          expect(current.schema_raw_visibility.ZOD).toBe("FINAL");
        });
      });
    expect(seen).toEqual([
      [3, "bootstrap"],
      ["4", "loader"],
    ]);
    expect(zodTransforms).toBe(1);
    await app.teardown();
  });

  it("retains legacy default fields across partial pre-final merges", async () => {
    expect.assertions(1);
    const library = CreateLibrary({
      configuration: {
        VALUE: { default: { a: 1, b: 2 }, type: "internal" },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_legacy_partial",
      services: {
        registerLoaders({ internal }) {
          internal.config.merge({
            schema_legacy_partial: { VALUE: { a: 3 } },
          } as never);
        },
      },
    });
    const app = await TestRunner({ target: library }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        // @ts-expect-error local fixture name is not declaration-merged
        expect(config.schema_legacy_partial.VALUE).toEqual({ a: 3, b: 2 });
      });
    });
    await app.teardown();
  });

  it("keeps source values raw until the winning source is finalized", async () => {
    expect.assertions(1);
    process.env.SCHEMA_SOURCE_VALUE = "12";
    const library = CreateLibrary({
      configuration: {
        VALUE: { schema: Type.Number(), source: ["env"] },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_source",
      services: {},
    });

    const runner = TestRunner({ target: library }).setOptions({ loadConfigs: true });
    const app = await runner.run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        // @ts-expect-error local fixture name is not declaration-merged
        expect(config.schema_source.VALUE).toBe(12);
      });
    });
    await app.teardown();
  });

  it("parses final TypeBox container strings and preserves string content", async () => {
    expect.assertions(5);
    process.env.SCHEMA_CONTAINERS_RECORD = '{"retries":"3"}';
    process.env.SCHEMA_CONTAINERS_OBJECT = '{"count":"7"}';
    process.env.SCHEMA_CONTAINERS_TEXT = '{"keep":"text"}';
    process.env.SCHEMA_CONTAINERS_CODEC_TEXT = '{"keep":"codec"}';
    const originalArgv = process.argv;
    process.argv = [...originalArgv, '--schema_containers_ARRAY=["1","2"]'];
    try {
      const library = CreateLibrary({
        configuration: {
          RECORD: { schema: Type.Record(Type.String(), Type.Number()) },
          ARRAY: { schema: Type.Array(Type.Number()) },
          OBJECT: {
            schema: Type.Object({
              count: Type.Number(),
              enabled: Type.Boolean({ default: true }),
            }),
          },
          TEXT: { schema: Type.String() },
          CODEC_TEXT: {
            schema: Type.Codec(Type.String())
              .Decode(value => value)
              .Encode(value => value),
          },
        },
        // @ts-expect-error local fixture name is not declaration-merged
        name: "schema_containers",
        services: {},
      });
      const app = await TestRunner({ target: library })
        .setOptions({ loadConfigs: true })
        .run(({ config, lifecycle }) => {
          lifecycle.onPostConfig(() => {
            // @ts-expect-error local fixture name is not declaration-merged
            expect(config.schema_containers.RECORD).toEqual({ retries: 3 });
            // @ts-expect-error local fixture name is not declaration-merged
            expect(config.schema_containers.ARRAY).toEqual([1, 2]);
            // @ts-expect-error local fixture name is not declaration-merged
            expect(config.schema_containers.OBJECT).toEqual({ count: 7, enabled: true });
            // @ts-expect-error local fixture name is not declaration-merged
            expect(config.schema_containers.TEXT).toBe('{"keep":"text"}');
            // @ts-expect-error local fixture name is not declaration-merged
            expect(config.schema_containers.CODEC_TEXT).toBe('{"keep":"codec"}');
          });
        });
      await app.teardown();
    } finally {
      process.argv = originalArgv;
    }
  });

  it("rejects malformed winning TypeBox JSON without exposing input", async () => {
    expect.assertions(3);
    const secret = '{"token":"container-secret"';
    process.env.SCHEMA_CONTAINER_BAD_VALUE = secret;
    const library = CreateLibrary({
      configuration: { VALUE: { schema: Type.Object({ token: Type.String() }) } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_container_bad",
      services: {},
    });
    const error = await TestRunner({ target: library })
      .setOptions({ loadConfigs: true })
      .run(() => {})
      .catch(value => value);
    expect(error).toBeInstanceOf(BootstrapException);
    expect((error as BootstrapException).cause).toBe("CONFIG_SCHEMA_PROCESSING_FAILED");
    expect((error as BootstrapException).message).not.toContain(secret);
  });

  it("does not parse or reject a losing malformed TypeBox JSON source", async () => {
    expect.assertions(1);
    process.env.SCHEMA_CONTAINER_LOSING_VALUE = '{"count":';
    const originalArgv = process.argv;
    process.argv = [...originalArgv, '--schema_container_losing_VALUE={"count":"5"}'];
    try {
      const library = CreateLibrary({
        configuration: { VALUE: { schema: Type.Object({ count: Type.Number() }) } },
        // @ts-expect-error local fixture name is not declaration-merged
        name: "schema_container_losing",
        services: {},
      });
      const app = await TestRunner({ target: library })
        .setOptions({ loadConfigs: true })
        .run(({ config, lifecycle }) => {
          lifecycle.onPostConfig(() => {
            // @ts-expect-error local fixture name is not declaration-merged
            expect(config.schema_container_losing.VALUE).toEqual({ count: 5 });
          });
        });
      await app.teardown();
    } finally {
      process.argv = originalArgv;
    }
  });

  it("overlays output-shaped pre-final mutations after schema processing", async () => {
    expect.assertions(4);
    const constructorUrl = new URL("https://constructor.example");
    const preInitUrl = new URL("https://pre-init.example");
    const seen: unknown[] = [];
    const library = CreateLibrary({
      configuration: {
        NUMBER: { schema: z.string().transform(value => Number(value)) },
        URL: { schema: z.string().transform(value => new URL(value)) },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_pre_final",
      services: {
        seed({ internal, lifecycle }) {
          internal.config.set("schema_pre_final" as never, "NUMBER" as never, 7 as never);
          internal.config.set("schema_pre_final" as never, "URL" as never, constructorUrl as never);
          lifecycle.onPreInit(() => {
            internal.config.merge({
              schema_pre_final: { NUMBER: 8, URL: preInitUrl },
            } as never);
          });
          internal.config.registerLoader(async ({ internal: loaderInternal }) => {
            const current = loaderInternal.boilerplate.configuration[
              INJECTED_DEFINITIONS
            ] as unknown as { schema_pre_final: { NUMBER: number; URL: URL } };
            seen.push(current.schema_pre_final.NUMBER);
            seen.push(current.schema_pre_final.URL === preInitUrl);
            return { schema_pre_final: { NUMBER: "9" } } as never;
          }, "custom_pre_final" as never);
        },
      },
    });
    const app = await TestRunner({ target: library }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        const current = config as unknown as { schema_pre_final: { NUMBER: number; URL: URL } };
        expect(current.schema_pre_final.NUMBER).toBe(9);
        expect(current.schema_pre_final.URL).toBe(preInitUrl);
      });
    });
    expect(seen).toEqual([8, true]);
    expect(app.booted).toBe(true);
    await app.teardown();
  });

  it("routes encoded bootstrap configuration through the raw input path", async () => {
    expect.assertions(3);
    const constructorUrl = new URL("https://constructor.example");
    const library = CreateLibrary({
      configuration: {
        NUMBER: { schema: z.string().transform(value => Number(value)) },
        URL: { schema: z.string().transform(value => new URL(value)) },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_bootstrap_raw",
      services: {
        seed({ internal }) {
          internal.config.set("schema_bootstrap_raw" as never, "NUMBER" as never, 99 as never);
          internal.config.set(
            "schema_bootstrap_raw" as never,
            "URL" as never,
            constructorUrl as never,
          );
        },
      },
    });
    const app = await TestRunner({ target: library })
      .setOptions({
        configuration: {
          schema_bootstrap_raw: { NUMBER: "42", URL: "https://bootstrap.example" },
        } as never,
      })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          const current = config as unknown as {
            schema_bootstrap_raw: { NUMBER: number; URL: URL };
          };
          expect(current.schema_bootstrap_raw.NUMBER).toBe(42);
          expect(current.schema_bootstrap_raw.URL).toBeInstanceOf(URL);
          expect(current.schema_bootstrap_raw.URL).not.toBe(constructorUrl);
        });
      });
    await app.teardown();
  });

  it("fails missing bare TypeBox values while preserving native undefined unions", async () => {
    expect.assertions(2);
    const primitive = CreateLibrary({
      configuration: { VALUE: { schema: Type.Number() } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_missing",
      services: {},
    });
    await expect(TestRunner({ target: primitive }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_INVALID",
    });

    const union = CreateLibrary({
      configuration: { VALUE: { schema: Type.Union([Type.String(), Type.Undefined()]) } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_undefined_union",
      services: {},
    });
    const app = await TestRunner({ target: union }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        // @ts-expect-error local fixture name is not declaration-merged
        expect(config.schema_undefined_union.VALUE).toBeUndefined();
      });
    });
    await app.teardown();
  });

  it("honors root TypeBox optional markers, defaults, and nested optional properties", async () => {
    expect.assertions(4);
    const library = CreateLibrary({
      configuration: {
        OPTIONAL: { schema: Type.Optional(Type.String()) },
        CODEC: {
          schema: Type.Optional(
            Type.Codec(Type.String())
              .Decode(value => value.toUpperCase())
              .Encode(value => value),
          ),
        },
        DEFAULTED: { schema: Type.Optional(Type.String({ default: "native" })) },
        NESTED: {
          schema: Type.Object({
            required: Type.String(),
            optional: Type.Optional(Type.Number()),
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_optional",
      services: {},
    });
    const app = await TestRunner({ target: library })
      .configure({ schema_optional: { NESTED: { required: "present" } } })
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_optional.OPTIONAL).toBeUndefined();
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_optional.CODEC).toBeUndefined();
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_optional.DEFAULTED).toBe("native");
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_optional.NESTED).toEqual({ required: "present" });
        });
      });
    await app.teardown();
  });

  it("accepts absent root Optional values before TypeBox validation callbacks", async () => {
    expect.assertions(2);
    let callbackCalls = 0;
    const format = "schema-optional-callback";
    Format.Set(format, () => {
      callbackCalls += 1;
      return false;
    });
    const library = CreateLibrary({
      configuration: {
        VALUE: { schema: Type.Optional(Type.String({ format })) },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_optional_callback",
      services: {},
    });
    const app = await TestRunner({ target: library }).run(({ config, lifecycle }) => {
      lifecycle.onPostConfig(() => {
        const current = config as unknown as { schema_optional_callback: { VALUE: undefined } };
        expect(current.schema_optional_callback.VALUE).toBeUndefined();
      });
    });
    expect(callbackCalls).toBe(0);
    await app.teardown();
  });

  it("rejects supplied invalid values for root TypeBox optional schemas", async () => {
    expect.assertions(1);
    const library = CreateLibrary({
      configuration: { VALUE: { schema: Type.Optional(Type.String({ minLength: 2 })) } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_optional_invalid",
      services: {},
    });
    await expect(
      TestRunner({ target: library })
        .configure({ schema_optional_invalid: { VALUE: "x" } })
        .run(() => {}),
    ).rejects.toMatchObject({ cause: "CONFIG_SCHEMA_INVALID" });
  });

  it("retains legacy required validation", async () => {
    expect.assertions(1);
    const library = CreateLibrary({
      configuration: { VALUE: { required: true, type: "string" } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_legacy_required",
      services: {},
    });
    await expect(TestRunner({ target: library }).run(() => {})).rejects.toMatchObject({
      cause: "REQUIRED_CONFIGURATION_MISSING",
    });
  });

  it("rejects both, neither, malformed, and required schema declarations at runtime", async () => {
    expect.assertions(6);
    const invalidTargets = [
      {
        configuration: {
          VALUE: {
            schema: Type.String(),
            type: "string",
          },
        },
        name: "schema_both",
      },
      {
        configuration: { VALUE: {} },
        name: "schema_neither",
      },
      {
        configuration: { VALUE: { schema: { type: "string" } } },
        name: "schema_malformed",
      },
      {
        configuration: { VALUE: { schema: { "~kind": "Number" } } },
        name: "schema_forged_marker",
      },
      {
        configuration: { VALUE: { schema: Type.String(), required: false } },
        name: "schema_required_false",
      },
      {
        configuration: { VALUE: { schema: Type.String(), required: undefined } },
        name: "schema_required_undefined",
      },
    ].map(entry =>
      CreateLibrary({
        configuration: entry.configuration as never,
        // @ts-expect-error local fixture name is not declaration-merged
        name: entry.name,
        services: {},
      }),
    );

    await expect(TestRunner({ target: invalidTargets[0] }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIGURATION_DEFINITION_INVALID",
    });
    await expect(TestRunner({ target: invalidTargets[1] }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIGURATION_DEFINITION_INVALID",
    });
    await expect(TestRunner({ target: invalidTargets[2] }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_UNSUPPORTED",
    });
    await expect(TestRunner({ target: invalidTargets[3] }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_UNSUPPORTED",
    });
    await expect(TestRunner({ target: invalidTargets[4] }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIGURATION_DEFINITION_INVALID",
    });
    await expect(TestRunner({ target: invalidTargets[5] }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIGURATION_DEFINITION_INVALID",
    });
  });

  it("sanitizes provider messages, paths, and thrown values", async () => {
    expect.assertions(3);
    const invalid = CreateLibrary({
      configuration: { VALUE: { schema: Type.Number() } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_safe_error",
      services: {},
    });
    const invalidApp = TestRunner({ target: invalid }).configure({
      schema_safe_error: { VALUE: "secret-value" as never },
    });
    await expect(invalidApp.run(() => {})).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_INVALID",
    });

    const throwing = CreateLibrary({
      configuration: {
        VALUE: {
          schema: {
            "~standard": {
              vendor: "throwing",
              version: 1 as const,
              validate() {
                throw new Error("secret-provider-message");
              },
            },
          },
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_safe_throw",
      services: {},
    });
    const error = await TestRunner({ target: throwing })
      .run(() => {})
      .catch(value => value);
    expect(error).toBeInstanceOf(BootstrapException);
    expect((error as BootstrapException).message).not.toContain("secret-provider-message");
  });

  it("classifies missing TypeBox roots separately from broken installations", () => {
    expect(
      classifyTypeBoxPeerFailure({
        code: "MODULE_NOT_FOUND",
        message: "Cannot find module 'typebox'",
      }),
    ).toBe("missing");
    expect(
      classifyTypeBoxPeerFailure({
        code: "ERR_MODULE_NOT_FOUND",
        message: "Cannot find module '/peer/typebox/build/value/index.mjs'",
      }),
    ).toBe("broken");
    expect(classifyTypeBoxPeerFailure({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" })).toBe("broken");
  });

  it("sanitizes provider-thrown BootstrapException values", async () => {
    const secret = "provider-secret-cause-and-message";
    const standard = {
      "~standard": {
        vendor: "throwing-bootstrap",
        version: 1 as const,
        validate() {
          throw new BootstrapException("provider:standard" as never, secret, secret);
        },
      },
    };
    const zod = z.string().transform(() => {
      throw new BootstrapException("provider:zod" as never, secret, secret);
    });
    const typebox = Type.Codec(Type.String())
      .Decode(() => {
        throw new BootstrapException("provider:typebox" as never, secret, secret);
      })
      .Encode(value => String(value));
    const cases = [
      ["schema_safe_bootstrap_standard", standard],
      ["schema_safe_bootstrap_zod", zod],
      ["schema_safe_bootstrap_typebox", typebox],
    ] as const;
    expect.assertions(cases.length * 3);

    for (const [name, schema] of cases) {
      const library = CreateLibrary({
        configuration: { VALUE: { schema: schema as never } } as never,
        // @ts-expect-error local fixture name is not declaration-merged
        name,
        services: {},
      });
      const error = await TestRunner({ target: library })
        .configure({ [name]: { VALUE: "value" } } as never)
        .run(() => {})
        .catch(value => value);
      expect(error).toBeInstanceOf(BootstrapException);
      expect((error as BootstrapException).cause).toBe("CONFIG_SCHEMA_PROCESSING_FAILED");
      expect(
        `${(error as BootstrapException).message}:${(error as BootstrapException).cause}`,
      ).not.toContain(secret);
    }
  });

  it("exposes safe metadata without re-executing prepared default factories", async () => {
    expect.assertions(8);
    let factoryCalls = 0;
    const library = CreateLibrary({
      configuration: {
        VALUE: {
          schema: Type.Number({
            default: () => {
              factoryCalls += 1;
              return 8;
            },
            description: "safe description",
            title: "Safe title",
          }),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_metadata",
      services: {},
    });

    await runAndTeardown(library, ({ internal, lifecycle }) => {
      lifecycle.onPreInit(() => {
        const callsBeforeMetadata = factoryCalls;
        const metadata = internal.config.getMetadata();
        const entry = metadata.find(
          item => item.library === "schema_metadata" && item.property === "VALUE",
        );
        expect(Object.isFrozen(metadata)).toBe(false);
        expect(Object.isFrozen(entry)).toBe(false);
        expect(entry?.provider).toBe("typebox");
        expect(entry?.description).toBe("safe description");
        expect(Object.hasOwn(entry ?? {}, "required")).toBe(false);
        expect(entry?.default).toEqual({ kind: "dynamic" });
        expect(factoryCalls).toBe(callsBeforeMetadata);
      });
    });
    expect(factoryCalls).toBe(1);
  });

  it("preserves schema input identity through transitive depends and nested implies", async () => {
    expect.assertions(2);
    const dependsLeaf = CreateLibrary({
      configuration: { VALUE: { schema: Type.Unsafe<URL>({ type: "object" }) } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_depends_leaf",
      services: {},
    });
    const dependsMiddle = CreateLibrary({
      depends: [dependsLeaf],
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_depends_middle",
      services: {},
    });
    const impliesLeaf = CreateLibrary({
      configuration: { VALUE: { schema: Type.Unsafe<URL>({ type: "object" }) } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_implies_leaf",
      services: {},
    });
    const impliesMiddle = CreateLibrary({
      implies: [impliesLeaf],
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_implies_middle",
      services: {},
    });
    const root = CreateLibrary({
      depends: [dependsMiddle],
      implies: [impliesMiddle],
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_transitive_root",
      services: {},
    });
    const dependsUrl = new URL("https://depends.example");
    const impliesUrl = new URL("https://implies.example");
    const app = await TestRunner({ target: root })
      .configure({
        schema_depends_leaf: { VALUE: dependsUrl },
        schema_implies_leaf: { VALUE: impliesUrl },
      } as never)
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture names are not declaration-merged
          expect(config.schema_depends_leaf.VALUE).toBe(dependsUrl);
          // @ts-expect-error local fixture names are not declaration-merged
          expect(config.schema_implies_leaf.VALUE).toBe(impliesUrl);
        });
      });
    await app.teardown();
  });

  it("discovers schema definitions from a replaced library closure", async () => {
    expect.assertions(1);
    const originalLeaf = CreateLibrary({
      configuration: { VALUE: { schema: Type.Unsafe<URL>({ type: "object" }) } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_replaced_leaf",
      services: {},
    });
    const originalMiddle = CreateLibrary({
      depends: [originalLeaf],
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_replaced_middle",
      services: {},
    });
    const replacementLeaf = CreateLibrary({
      configuration: { VALUE: { schema: Type.Unsafe<URL>({ type: "object" }) } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_replaced_leaf",
      services: {},
    });
    const replacementMiddle = CreateLibrary({
      depends: [replacementLeaf],
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_replaced_middle",
      services: {},
    });
    const root = CreateLibrary({
      depends: [originalMiddle],
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_replacement_root",
      services: {},
    });
    const url = new URL("https://replacement.example");
    const app = await TestRunner({ target: root })
      .replaceLibrary("schema_replaced_middle", replacementMiddle)
      .configure({ schema_replaced_leaf: { VALUE: url } } as never)
      .run(({ config, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_replaced_leaf.VALUE).toBe(url);
        });
      });
    await app.teardown();
  });

  it("preserves schema identity through module cloning and atomic config merges", async () => {
    expect.assertions(4);
    const schema = Type.Unsafe<URL>({ type: "object" });
    const original = CreateLibrary({
      configuration: { VALUE: { schema } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_identity",
      services: {},
    });
    const cloned = createModule.fromLibrary(original).extend().toLibrary();
    expect(cloned.configuration.VALUE.schema).toBe(schema);

    const url = new URL("https://example.test");
    const app = await TestRunner({ target: original })
      .configure({ schema_identity: { VALUE: url } })
      .run(({ config, internal, lifecycle }) => {
        lifecycle.onPostConfig(() => {
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_identity.VALUE).toBe(url);
          internal.config.merge({ schema_identity: { VALUE: url } } as never);
          // @ts-expect-error local fixture name is not declaration-merged
          expect(config.schema_identity.VALUE).toBe(url);
        });
      });
    // The application remains a normal teardown-capable test result.
    expect(app.booted).toBe(true);
    await app.teardown();
  });

  it("does not introduce bootstrap registration for schema libraries", async () => {
    expect.assertions(1);
    const app = asApplication(TYPEBOX_TYPED_LIBRARY);
    await app.bootstrap({ configuration: { schema_typed: { CODEC: "5" } } as never });
    expect(app.booted).toBe(true);
    await app.teardown();
  });
});
