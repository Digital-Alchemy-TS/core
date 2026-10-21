// cspell:words typebox
import type { StaticDecode, StaticEncode } from "typebox";

import type { SINGLE } from "./utilities.mts";

/** A JSON-serialisable value exposed by schema metadata. */
export type SerializableMetadata =
  | boolean
  | null
  | number
  | readonly SerializableMetadata[]
  | string
  | { readonly [key: string]: SerializableMetadata };

/** The Standard Schema v1 validation result shape used by schema providers. */
export type StandardSchemaResult<OUTPUT> =
  | { readonly value: OUTPUT }
  | { readonly issues: readonly StandardSchemaIssue[] };

/** The public issue shape accepted by Standard Schema v1 providers. */
export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[];
}

/** A minimal Standard Schema v1 contract with provider-disjoint inference. */
export interface StandardSchemaV1<INPUT = unknown, OUTPUT = INPUT> {
  readonly "~standard": {
    readonly vendor: string;
    readonly version: typeof SINGLE;
    readonly types?: {
      readonly input: INPUT;
      readonly output: OUTPUT;
    };
    readonly validate: (
      value: unknown,
      options?: { readonly libraryOptions?: Record<string, unknown> },
    ) => StandardSchemaResult<OUTPUT> | Promise<StandardSchemaResult<OUTPUT>>;
  };
}

/** Supported TypeBox schema markers. TSchema itself is intentionally empty. */
export type SupportedTypeBoxSchema = { readonly "~kind": string } | { readonly "~unsafe": unknown };

/** All schema values accepted by a schema-backed configuration entry. */
export type ConfigSchema = StandardSchemaV1 | SupportedTypeBoxSchema;

/** Input accepted by a supported schema provider. */
export type SchemaInput<SCHEMA extends ConfigSchema> = SCHEMA extends StandardSchemaV1
  ? StandardSchemaInput<SCHEMA>
  : SCHEMA extends SupportedTypeBoxSchema
    ? StaticEncode<SCHEMA>
    : never;

/** Output injected after a supported schema provider has processed a value. */
export type SchemaOutput<SCHEMA extends ConfigSchema> = SCHEMA extends StandardSchemaV1
  ? StandardSchemaOutput<SCHEMA>
  : SCHEMA extends SupportedTypeBoxSchema
    ? StaticDecode<SCHEMA>
    : never;

/** Normalised provider identity used by metadata and diagnostics. */
export type SchemaProvider = "standard" | "typebox" | "zod";

/** A schema-owned default that is safe for documentation tooling to consume. */
export type SchemaDefaultMetadata =
  | { readonly kind: "dynamic" }
  | { readonly kind: "static"; readonly value: SerializableMetadata }
  | { readonly kind: "unknown" };

/** Normalised, read-only metadata extracted without executing schema defaults. */
export type SchemaMetadata = Readonly<{
  default?: SchemaDefaultMetadata;
  description?: string;
  examples?: SerializableMetadata;
  provider: SchemaProvider;
  title?: string;
}>;

/** Infer a Standard Schema input while tolerating providers without type metadata. */
type StandardSchemaInput<SCHEMA extends StandardSchemaV1> =
  NonNullable<SCHEMA["~standard"]["types"]> extends {
    readonly input: infer INPUT;
  }
    ? INPUT
    : unknown;

/** Infer a Standard Schema output while tolerating providers without type metadata. */
type StandardSchemaOutput<SCHEMA extends StandardSchemaV1> =
  NonNullable<SCHEMA["~standard"]["types"]> extends {
    readonly output: infer OUTPUT;
  }
    ? OUTPUT
    : unknown;
