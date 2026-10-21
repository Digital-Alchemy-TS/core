import { is, SINGLE } from "../index.mts";
import {
  processingFailure,
  providerCallAsync,
  schemaException,
  type SchemaLocation,
  validationFailure,
} from "./config-errors.mts";
import type { ConfigSchema, StandardSchemaV1 } from "./config-types.mts";

const SINGLE_VALIDATION_ISSUE = SINGLE;

/** Return true when a value has the supported Standard Schema v1 surface. */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  if (!is.object(value) || !("~standard" in value)) {
    return false;
  }
  const record = value as Record<PropertyKey, unknown>;
  const standard = record["~standard"];
  if (!is.object(standard)) {
    return false;
  }
  const surface = standard as Record<PropertyKey, unknown>;
  return surface.version === SINGLE && is.string(surface.vendor) && is.function(surface.validate);
}

function isZodSchema(schema: Record<PropertyKey, unknown>): boolean {
  return is.object(schema._zod) && is.object(schema.def) && is.function(schema.safeParseAsync);
}

function hasValidationIssues(result: Record<PropertyKey, unknown>): boolean {
  return Object.hasOwn(result, "issues") && !is.undefined(result.issues);
}

/**
 * Process one Zod-backed configuration value through its native async parser.
 *
 * @throws {BootstrapException} `CONFIG_SCHEMA_PROVIDER_UNSUPPORTED` when the
 *   Zod surface is not compatible, `CONFIG_SCHEMA_INVALID` when validation
 *   fails, and `CONFIG_SCHEMA_PROCESSING_FAILED` when the provider throws.
 * @internal
 */
export async function processZodValue(
  schema: ConfigSchema,
  value: unknown,
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
  const parseAsync = (zodSchema.safeParseAsync as (input: unknown) => Promise<unknown>).bind(
    zodSchema,
  );
  const result = await providerCallAsync(location, "zod", () => parseAsync(value));
  if (!is.object(result)) {
    processingFailure(location, "zod");
  }
  const resultRecord = result as Record<PropertyKey, unknown>;
  if (!is.boolean(resultRecord.success)) {
    processingFailure(location, "zod");
  }
  if (resultRecord.success !== true) {
    validationFailure(location, "zod", SINGLE_VALIDATION_ISSUE);
  }
  if (!Object.hasOwn(resultRecord, "data")) {
    processingFailure(location, "zod");
  }
  return resultRecord.data;
}

/**
 * Process one generic Standard Schema-backed configuration value.
 *
 * @throws {BootstrapException} `CONFIG_SCHEMA_INVALID` when validation returns
 *   issues and `CONFIG_SCHEMA_PROCESSING_FAILED` when the provider throws or
 *   returns an invalid result shape.
 * @internal
 */
export async function processStandardValue(
  schema: ConfigSchema,
  value: unknown,
  location: SchemaLocation,
): Promise<unknown> {
  const standard = (schema as StandardSchemaV1)["~standard"];
  const result = (await providerCallAsync(location, "standard", () =>
    standard.validate(value),
  )) as unknown;
  if (!is.object(result)) {
    processingFailure(location, "standard");
  }
  const resultRecord = result as Record<PropertyKey, unknown>;
  if (hasValidationIssues(resultRecord)) {
    const issues = resultRecord.issues;
    validationFailure(
      location,
      "standard",
      is.array(issues) ? issues.length : SINGLE_VALIDATION_ISSUE,
    );
  }
  if (!Object.hasOwn(resultRecord, "value")) {
    processingFailure(location, "standard");
  }
  return resultRecord.value;
}
