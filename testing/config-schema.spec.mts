import { Type } from "typebox";
import { z } from "zod";

import type {
  ApplicationDefinition,
  ConfigInputTypes,
  ConfigTypes,
  LibraryDefinition,
  OptionalModuleConfiguration,
  ServiceMap,
  TServiceParams,
} from "../src/index.mts";
import { BootstrapException, CreateLibrary, createModule, TestRunner } from "../src/index.mts";

// ─── Local compile-time assertions ────────────────────────────────────────────

type TypeEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type ExpectTrue<T extends true> = T;

const CODEC_SCHEMA = Type.Codec(Type.String())
  .Decode(value => Number(value))
  .Encode(value => String(value));
const ZOD_TRANSFORM_SCHEMA = z.string().transform(value => value.length);

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

type TypeBoxTypedInput = ConfigInputTypes<typeof TYPEBOX_TYPED_LIBRARY.configuration>;
type TypeBoxTypedOutput = ConfigTypes<typeof TYPEBOX_TYPED_LIBRARY.configuration>;
type ZodTypedInput = ConfigInputTypes<typeof ZOD_TYPED_LIBRARY.configuration>;
type ZodTypedOutput = ConfigTypes<typeof ZOD_TYPED_LIBRARY.configuration>;

export type _CodecInputIsEncodedString = ExpectTrue<TypeEqual<TypeBoxTypedInput["CODEC"], string>>;
export type _CodecOutputIsDecodedNumber = ExpectTrue<
  TypeEqual<TypeBoxTypedOutput["CODEC"], number>
>;
export type _ZodInputIsString = ExpectTrue<TypeEqual<ZodTypedInput["VALUE"], string>>;
export type _ZodOutputIsNumber = ExpectTrue<TypeEqual<ZodTypedOutput["VALUE"], number>>;

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
    delete process.env.SCHEMA_LOSING_VALUE;
    delete process.env.SCHEMA_SOURCE_VALUE;
    delete process.env.SCHEMA_WINNING_VALUE;
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
    expect.assertions(4);
    let transformCount = 0;
    const asyncSchema = z.string().transform(async value => {
      transformCount += 1;
      return value.toUpperCase();
    });
    const library = CreateLibrary({
      configuration: {
        ASYNC: { schema: asyncSchema },
        DEFAULTED: { schema: z.string().default("native") },
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

  it("preserves source precedence for losing invalid values and rejects winning invalid values", async () => {
    expect.assertions(2);
    process.env.SCHEMA_LOSING_VALUE = "not-a-number";
    const losing = CreateLibrary({
      configuration: {
        VALUE: { schema: Type.Number(), source: ["argv"] },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_losing",
      services: {},
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

    process.env.SCHEMA_WINNING_VALUE = "not-a-number";
    const winning = CreateLibrary({
      configuration: {
        VALUE: { schema: Type.Number(), source: ["env"] },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_winning",
      services: {},
    });
    await expect(TestRunner({ target: winning }).setOptions({ loadConfigs: true }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_INVALID",
    });
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

  it("preserves native missing and outer required semantics", async () => {
    expect.assertions(2);
    const optional = CreateLibrary({
      configuration: {
        VALUE: {
          required: true,
          schema: Type.Union([Type.String(), Type.Undefined()]),
        },
      },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_required",
      services: {},
    });

    await expect(TestRunner({ target: optional }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_REQUIRED",
    });

    const primitive = CreateLibrary({
      configuration: { VALUE: { schema: Type.Number() } },
      // @ts-expect-error local fixture name is not declaration-merged
      name: "schema_missing",
      services: {},
    });
    await expect(TestRunner({ target: primitive }).run(() => {})).rejects.toMatchObject({
      cause: "CONFIG_SCHEMA_INVALID",
    });
  });

  it("rejects both, neither, and malformed schema declarations at runtime", async () => {
    expect.assertions(3);
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

  it("exposes safe metadata without executing default factories", async () => {
    expect.assertions(5);
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
        const entry = internal.config
          .getMetadata()
          .find(
            metadata => metadata.library === "schema_metadata" && metadata.property === "VALUE",
          );
        expect(entry?.provider).toBe("typebox");
        expect(entry?.description).toBe("safe description");
        expect(entry?.default).toEqual({ kind: "dynamic" });
        expect(factoryCalls).toBe(0);
      });
    });
    expect(factoryCalls).toBe(1);
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
