// cspell:disable
import { createRequire } from "node:module";

import type { StaticDecode, StaticEncode } from "typebox";

import type { TContext } from "./context.mts";
import { BootstrapException } from "./errors.mts";

// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Standard Schema protocol version.
const STANDARD_SCHEMA_VERSION = 1 as const;
const NO_VALIDATION_ERRORS = 0;
const SINGLE_VALIDATION_ISSUE = 1;

/** A JSON-serialisable value exposed by schema metadata. */
export type SerializableMetadata =
  | boolean
  | null
  | number
  | readonly SerializableMetadata[]
  | string
  | { readonly [key: string]: SerializableMetadata };

/** The Standard Schema v1 validation result shape used by schema providers. */
/* eslint-disable sonarjs/no-redundant-optional -- Standard Schema success results may omit `issues`. */
export type StandardSchemaResult<OUTPUT> =
  | { readonly issues?: undefined; readonly value: OUTPUT }
  | { readonly issues: readonly StandardSchemaIssue[] };
/* eslint-enable sonarjs/no-redundant-optional */

/** The public issue shape accepted by Standard Schema v1 providers. */
export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[];
}

/** A minimal Standard Schema v1 contract with provider-disjoint inference. */
export interface StandardSchemaV1<INPUT = unknown, OUTPUT = INPUT> {
  readonly "~standard": {
    readonly vendor: string;
    readonly version: typeof STANDARD_SCHEMA_VERSION;
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

/** Options identifying a config key in a contextual bootstrap diagnostic. */
type SchemaLocation = {
  context: TContext;
  property: string;
  project: string;
};

type TypeBoxValueModule = {
  Clone: (value: unknown) => unknown;
  Convert: (type: unknown, value: unknown) => unknown;
  DecodeUnsafe: (context: Record<string, never>, type: unknown, value: unknown) => unknown;
  Default: (type: unknown, value: unknown) => unknown;
  Errors: (type: unknown, value: unknown) => readonly unknown[];
};

type StandardSchemaSurface = {
  readonly vendor?: unknown;
  readonly version?: unknown;
  readonly types?: unknown;
  readonly validate?: unknown;
};

const TYPEBOX_KIND_TYPES = new Map<string, string>([
  ["Array", "array"],
  ["BigInt", "bigint"],
  ["Boolean", "boolean"],
  ["Constructor", "constructor"],
  ["Function", "function"],
  ["Integer", "integer"],
  ["Null", "null"],
  ["Number", "number"],
  ["Object", "object"],
  ["Record", "object"],
  ["Rest", "rest"],
  ["String", "string"],
  ["Symbol", "symbol"],
  ["TemplateLiteral", "string"],
  ["Tuple", "array"],
  ["Undefined", "undefined"],
  ["Void", "void"],
]);
const TYPEBOX_SCHEMA_TYPES = new Set(TYPEBOX_KIND_TYPES.values());
const TYPEBOX_KINDLESS_KEYS = new Set([
  "allOf",
  "anyOf",
  "const",
  "enum",
  "items",
  "not",
  "properties",
  "type",
  "$ref",
]);

const REQUIRE = createRequire(import.meta.url);
let typeBoxValueModule: Promise<TypeBoxValueModule> | undefined;

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

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeIdentifier(value: unknown): string {
  if (typeof value === "string" && /^[A-Za-z0-9_.-]+$/.test(value)) {
    return value;
  }
  return "<unknown>";
}

function locationText({ project, property }: SchemaLocation): string {
  return `${safeIdentifier(project)}.${safeIdentifier(property)}`;
}

function schemaException(
  location: SchemaLocation,
  cause: string,
  detail: string,
): BootstrapException {
  return new BootstrapException(
    location.context,
    cause,
    `Configuration schema ${detail} for ${locationText(location)}`,
  );
}

function isStandardSurface(value: Record<PropertyKey, unknown>): boolean {
  return "~standard" in value;
}

function isTypeBoxJsonSchemaShape(value: Record<PropertyKey, unknown>): boolean {
  if (typeof value.type === "string" && TYPEBOX_SCHEMA_TYPES.has(value.type)) {
    return true;
  }
  return (
    typeof value.$ref === "string" ||
    Array.isArray(value.anyOf) ||
    Array.isArray(value.allOf) ||
    isRecord(value.not) ||
    hasOwn(value, "const") ||
    Array.isArray(value.enum) ||
    isRecord(value.properties) ||
    hasOwn(value, "items")
  );
}

function isTypeBoxKindShape(kind: string, value: Record<PropertyKey, unknown>): boolean {
  const type = TYPEBOX_KIND_TYPES.get(kind);
  if (type !== undefined && value.type !== type) {
    return false;
  }
  switch (kind) {
    case "Any":
    case "Unknown":
      return [...TYPEBOX_KINDLESS_KEYS].every(key => !hasOwn(value, key));
    case "Array":
      return isRecord(value.items);
    case "Constructor":
      return Array.isArray(value.parameters) && isRecord(value.instanceType);
    case "Cyclic":
      return typeof value.$ref === "string" && isRecord(value.$defs);
    case "Enum":
      return Array.isArray(value.enum) && value.enum.length > NO_VALIDATION_ERRORS;
    case "Function":
      return Array.isArray(value.parameters) && isRecord(value.returnType);
    case "Intersect":
      return Array.isArray(value.allOf) && value.allOf.length > NO_VALIDATION_ERRORS;
    case "Literal":
      return (
        hasOwn(value, "const") &&
        ((value.type === "boolean" && typeof value.const === "boolean") ||
          (value.type === "number" && typeof value.const === "number") ||
          (value.type === "string" && typeof value.const === "string"))
      );
    case "Never":
    case "Not":
      return isRecord(value.not);
    case "Object":
      return isRecord(value.properties);
    case "Record":
      return isRecord(value.patternProperties);
    case "Ref":
      return typeof value.$ref === "string";
    case "Rest":
      return Array.isArray(value.items);
    case "TemplateLiteral":
      return typeof value.pattern === "string";
    case "This":
      return typeof value.$ref === "string";
    case "Tuple":
      return Array.isArray(value.items);
    case "Union":
      return Array.isArray(value.anyOf) && value.anyOf.length > NO_VALIDATION_ERRORS;
    default:
      return type !== undefined;
  }
}

function isTypeBoxMarker(value: Record<PropertyKey, unknown>): boolean {
  if (hasOwn(value, "~kind")) {
    const kind = value["~kind"];
    return typeof kind === "string" && !hasOwn(value, "~unsafe") && isTypeBoxKindShape(kind, value);
  }
  return hasOwn(value, "~unsafe") && value["~unsafe"] === null && isTypeBoxJsonSchemaShape(value);
}

/** Return true when a value has the supported Standard Schema v1 surface. */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  if (!isRecord(value) || !isStandardSurface(value)) {
    return false;
  }
  const standard = value["~standard"];
  return (
    isRecord(standard) &&
    standard.version === STANDARD_SCHEMA_VERSION &&
    typeof standard.vendor === "string" &&
    typeof standard.validate === "function"
  );
}

/** Return true when a value has a recognised TypeBox factory marker. */
export function isSupportedTypeBoxSchema(value: unknown): value is SupportedTypeBoxSchema {
  return isRecord(value) && isTypeBoxMarker(value) && !isStandardSurface(value);
}

/** Identify a schema provider and reject malformed or ambiguous provider surfaces. */
export function getSchemaProvider(schema: unknown, location: SchemaLocation): SchemaProvider {
  if (!isRecord(schema)) {
    throw schemaException(location, "CONFIG_SCHEMA_UNSUPPORTED", "value is unsupported");
  }

  const hasStandard = isStandardSurface(schema);
  const hasTypeBox = isTypeBoxMarker(schema);
  if (hasStandard && hasTypeBox) {
    throw schemaException(location, "CONFIG_SCHEMA_AMBIGUOUS", "value exposes multiple providers");
  }

  if (hasStandard) {
    const standard = schema["~standard"] as StandardSchemaSurface;
    if (
      standard === null ||
      typeof standard !== "object" ||
      standard.version !== STANDARD_SCHEMA_VERSION ||
      typeof standard.vendor !== "string" ||
      typeof standard.validate !== "function"
    ) {
      throw schemaException(location, "CONFIG_SCHEMA_UNSUPPORTED", "value is malformed");
    }
    return standard.vendor === "zod" ? "zod" : "standard";
  }

  if (hasTypeBox) {
    return "typebox";
  }

  throw schemaException(location, "CONFIG_SCHEMA_UNSUPPORTED", "value is unsupported");
}

// eslint-disable-next-line sonarjs/function-return-type -- non-serialisable metadata is intentionally omitted.
function serializeMetadata(
  value: unknown,
  seen = new Set<unknown>(),
): SerializableMetadata | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "object" || seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map(item => serializeMetadata(item, seen));
    return result.every(item => item !== undefined)
      ? (result as SerializableMetadata[])
      : undefined;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return undefined;
  }
  const result: Record<string, SerializableMetadata> = {};
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const item = serializeMetadata(record[key], seen);
    if (item === undefined) {
      return undefined;
    }
    result[key] = item;
  }
  return result;
}

/** Read a static default for metadata without invoking a factory. */
export function getDefaultMetadata(value: unknown): SchemaDefaultMetadata {
  if (typeof value === "function") {
    return { kind: "dynamic" };
  }
  const serialized = serializeMetadata(value);
  return serialized === undefined ? { kind: "unknown" } : { kind: "static", value: serialized };
}

function defaultMetadata(schema: Record<PropertyKey, unknown>): SchemaDefaultMetadata | undefined {
  return hasOwn(schema, "default") ? getDefaultMetadata(schema.default) : undefined;
}

/** Read safe schema metadata without evaluating defaults or provider callbacks. */
export function getSchemaMetadata(schema: unknown, location: SchemaLocation): SchemaMetadata {
  const provider = getSchemaProvider(schema, location);
  const record = schema as Record<PropertyKey, unknown>;
  const metadata: {
    default?: SchemaDefaultMetadata;
    description?: string;
    examples?: SerializableMetadata;
    provider: SchemaProvider;
    title?: string;
  } = { provider };
  if (typeof record.title === "string") {
    metadata.title = record.title;
  }
  if (typeof record.description === "string") {
    metadata.description = record.description;
  }
  if (hasOwn(record, "examples")) {
    const examples = serializeMetadata(record.examples);
    if (examples !== undefined) {
      metadata.examples = examples;
    }
  }
  const defaultValue = defaultMetadata(record);
  if (defaultValue) {
    metadata.default = defaultValue;
  }
  return metadata;
}

/** @internal — classify resolver failures without exposing provider error text. */
export function classifyTypeBoxPeerFailure(error: unknown): "broken" | "missing" {
  if (!isRecord(error)) {
    return "broken";
  }
  if (error.code !== "ERR_MODULE_NOT_FOUND" && error.code !== "MODULE_NOT_FOUND") {
    return "broken";
  }
  return typeof error.message === "string" &&
    /Cannot find (?:module|package) ['"]typebox['"]/.test(error.message)
    ? "missing"
    : "broken";
}

function resolveTypeBoxPeer(): "available" | "broken" | "missing" {
  try {
    REQUIRE.resolve("typebox");
    return "available";
  } catch (error) {
    return classifyTypeBoxPeerFailure(error);
  }
}

async function loadTypeBoxValue(location: SchemaLocation): Promise<TypeBoxValueModule> {
  const resolution = resolveTypeBoxPeer();
  if (resolution === "missing") {
    throw schemaException(
      location,
      "CONFIG_SCHEMA_PEER_MISSING",
      "requires the resolvable 'typebox' peer",
    );
  }
  if (resolution === "broken") {
    throw schemaException(
      location,
      "CONFIG_SCHEMA_PEER_BROKEN",
      "requires a compatible 'typebox/value' peer",
    );
  }

  let loaded: TypeBoxValueModule;
  try {
    typeBoxValueModule ??= import("typebox/value").then(module => module as TypeBoxValueModule);
    loaded = await typeBoxValueModule;
  } catch {
    typeBoxValueModule = undefined;
    throw schemaException(
      location,
      "CONFIG_SCHEMA_PEER_BROKEN",
      "requires a compatible 'typebox/value' peer",
    );
  }
  if (
    typeof loaded.Clone !== "function" ||
    typeof loaded.Convert !== "function" ||
    typeof loaded.DecodeUnsafe !== "function" ||
    typeof loaded.Default !== "function" ||
    typeof loaded.Errors !== "function"
  ) {
    throw schemaException(
      location,
      "CONFIG_SCHEMA_PEER_BROKEN",
      "requires a compatible 'typebox/value' peer",
    );
  }
  return loaded;
}

function validationFailure(
  location: SchemaLocation,
  provider: SchemaProvider,
  count: number,
): never {
  throw schemaException(
    location,
    "CONFIG_SCHEMA_INVALID",
    `${provider} validation failed with ${count} issue(s)`,
  );
}

function processingFailure(location: SchemaLocation, provider: SchemaProvider): never {
  throw schemaException(
    location,
    "CONFIG_SCHEMA_PROCESSING_FAILED",
    `${provider} processing failed`,
  );
}

function providerCall<OUTPUT>(
  location: SchemaLocation,
  provider: SchemaProvider,
  callback: () => OUTPUT,
): OUTPUT {
  try {
    return callback();
  } catch {
    processingFailure(location, provider);
  }
}

async function providerCallAsync<OUTPUT>(
  location: SchemaLocation,
  provider: SchemaProvider,
  callback: () => OUTPUT | Promise<OUTPUT>,
): Promise<OUTPUT> {
  try {
    return await callback();
  } catch {
    processingFailure(location, provider);
  }
}

function isZodSchema(schema: Record<PropertyKey, unknown>): boolean {
  return (
    isRecord(schema._zod) && isRecord(schema.def) && typeof schema.safeParseAsync === "function"
  );
}

function hasValidationIssues(result: Record<PropertyKey, unknown>): boolean {
  return hasOwn(result, "issues") && result.issues !== undefined;
}

async function processTypeBoxValue(
  schema: ConfigSchema,
  value: unknown,
  required: boolean,
  location: SchemaLocation,
): Promise<unknown> {
  const typeBox = await loadTypeBoxValue(location);
  const wasMissing = value === undefined;
  const candidate = providerCall(location, "typebox", () => typeBox.Clone(value));
  const defaulted = providerCall(location, "typebox", () => typeBox.Default(schema, candidate));
  // TypeBox clones static defaults but intentionally returns factory results as-is;
  // clone the completed candidate once more so provider-owned mutable defaults
  // cannot become the live configuration object.
  const isolated = providerCall(location, "typebox", () => typeBox.Clone(defaulted));
  const converted =
    wasMissing && isolated === undefined
      ? isolated
      : providerCall(location, "typebox", () => typeBox.Convert(schema, isolated));
  const errors = providerCall(location, "typebox", () => typeBox.Errors(schema, converted));
  if (errors.length > NO_VALIDATION_ERRORS) {
    validationFailure(location, "typebox", errors.length);
  }
  const output = providerCall(location, "typebox", () =>
    typeBox.DecodeUnsafe({}, schema, converted),
  );
  if (required && output === undefined) {
    throw schemaException(location, "CONFIG_SCHEMA_REQUIRED", "output is missing");
  }
  return output;
}

async function processZodValue(
  schema: ConfigSchema,
  value: unknown,
  required: boolean,
  location: SchemaLocation,
): Promise<unknown> {
  const zodSchema = schema as unknown as Record<PropertyKey, unknown>;
  if (!isZodSchema(zodSchema)) {
    throw schemaException(
      location,
      "CONFIG_SCHEMA_PROVIDER_UNSUPPORTED",
      "zod variant is unsupported",
    );
  }
  const parseAsync = zodSchema.safeParseAsync as (input: unknown) => Promise<unknown>;
  const result = (await providerCallAsync(location, "zod", () =>
    parseAsync.call(zodSchema, value),
  )) as Record<PropertyKey, unknown> | undefined;
  if (!isRecord(result) || typeof result.success !== "boolean") {
    processingFailure(location, "zod");
  }
  if (result.success !== true) {
    validationFailure(location, "zod", SINGLE_VALIDATION_ISSUE);
  }
  if (!hasOwn(result, "data")) {
    processingFailure(location, "zod");
  }
  if (required && result.data === undefined) {
    throw schemaException(location, "CONFIG_SCHEMA_REQUIRED", "output is missing");
  }
  return result.data;
}

async function processStandardValue(
  schema: ConfigSchema,
  value: unknown,
  required: boolean,
  location: SchemaLocation,
): Promise<unknown> {
  const standard = (schema as StandardSchemaV1)["~standard"];
  const result = (await providerCallAsync(location, "standard", () =>
    standard.validate(value),
  )) as unknown;
  if (!isRecord(result)) {
    processingFailure(location, "standard");
  }
  if (hasValidationIssues(result)) {
    const issues = result.issues;
    validationFailure(
      location,
      "standard",
      Array.isArray(issues) ? issues.length : SINGLE_VALIDATION_ISSUE,
    );
  }
  if (!hasOwn(result, "value")) {
    processingFailure(location, "standard");
  }
  if (required && result.value === undefined) {
    throw schemaException(location, "CONFIG_SCHEMA_REQUIRED", "output is missing");
  }
  return result.value;
}

/**
 * Process one schema-backed value after all source loaders have settled.
 *
 * @remarks
 * TypeBox uses its native Clone, Default, Convert, Errors and DecodeUnsafe pipeline.
 * Zod uses one native safeParseAsync call so async transforms are not executed twice.
 * Generic Standard Schema providers receive one awaited protocol call.
 */
export async function processSchemaValue(
  schema: ConfigSchema,
  value: unknown,
  required: boolean,
  location: SchemaLocation,
): Promise<unknown> {
  const provider = getSchemaProvider(schema, location);
  switch (provider) {
    case "typebox":
      return processTypeBoxValue(schema, value, required, location);
    case "zod":
      return processZodValue(schema, value, required, location);
    default:
      return processStandardValue(schema, value, required, location);
  }
}

/** Validate a configuration entry's runtime discriminator and schema shape. */
export function assertConfigEntry(value: unknown, location: SchemaLocation): void {
  if (!isRecord(value)) {
    throw schemaException(location, "CONFIGURATION_DEFINITION_INVALID", "definition is malformed");
  }
  const hasType = hasOwn(value, "type");
  const hasSchema = hasOwn(value, "schema");
  if (hasType === hasSchema) {
    throw schemaException(
      location,
      "CONFIGURATION_DEFINITION_INVALID",
      "definition must provide exactly one of type or schema",
    );
  }
  if (hasType) {
    if (typeof value.type !== "string" || !PROJECT_CONFIG_TYPES.has(value.type)) {
      throw schemaException(
        location,
        "CONFIGURATION_DEFINITION_INVALID",
        "legacy type is unsupported",
      );
    }
    return;
  }
  if (value.schema === undefined || value.schema === null) {
    throw schemaException(location, "CONFIGURATION_DEFINITION_INVALID", "schema is missing");
  }
  if (hasOwn(value, "default") || hasOwn(value, "description")) {
    throw schemaException(
      location,
      "CONFIGURATION_DEFINITION_INVALID",
      "schema metadata must be declared on the schema",
    );
  }
  getSchemaProvider(value.schema, location);
}

const PROJECT_CONFIG_TYPES = new Set([
  "boolean",
  "internal",
  "number",
  "record",
  "string",
  "string[]",
]);
