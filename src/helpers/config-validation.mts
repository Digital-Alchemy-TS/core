// cspell:disable
import { is } from "../index.mts";
import type { ProjectConfigTypes } from "./config.mts";
import { schemaException, type SchemaLocation } from "./config-errors.mts";
import { isStandardSchema, processStandardValue, processZodValue } from "./config-standard.mts";
import {
  hasTypeBoxSchemaMarker,
  isSupportedTypeBoxSchema,
  processTypeBoxValue,
} from "./config-typebox.mts";
import type { ConfigSchema, SchemaProvider } from "./config-types.mts";

const PROJECT_CONFIG_TYPES = new Set<ProjectConfigTypes>([
  "boolean",
  "internal",
  "number",
  "record",
  "string",
  "string[]",
]);

/** Identify a schema provider and reject malformed or ambiguous provider surfaces.
 *
 * @throws {BootstrapException} `CONFIG_SCHEMA_UNSUPPORTED` for unsupported or
 *   malformed schemas and `CONFIG_SCHEMA_AMBIGUOUS` when multiple providers are
 *   exposed by one value.
 */
export function getSchemaProvider(schema: unknown, location: SchemaLocation): SchemaProvider {
  if (!is.object(schema)) {
    throw schemaException(location, "CONFIG_SCHEMA_UNSUPPORTED", "value is unsupported");
  }

  const record = schema as Record<PropertyKey, unknown>;
  const hasStandard = "~standard" in record;
  const hasTypeBox = hasTypeBoxSchemaMarker(record);
  if (hasStandard && hasTypeBox) {
    throw schemaException(location, "CONFIG_SCHEMA_AMBIGUOUS", "value exposes multiple providers");
  }

  if (hasStandard) {
    if (!isStandardSchema(schema)) {
      throw schemaException(location, "CONFIG_SCHEMA_UNSUPPORTED", "value is malformed");
    }
    return schema["~standard"].vendor === "zod" ? "zod" : "standard";
  }

  if (hasTypeBox && isSupportedTypeBoxSchema(schema)) {
    return "typebox";
  }

  throw schemaException(location, "CONFIG_SCHEMA_UNSUPPORTED", "value is unsupported");
}

/**
 * Process one schema-backed configuration value through its native provider.
 *
 * @throws {BootstrapException} Provider-specific schema errors, including
 *   validation, missing required output, peer availability, and processing
 *   failures, are surfaced with contextual causes.
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

/**
 * Validate a configuration entry's runtime discriminator and schema shape.
 *
 * @throws {BootstrapException} `CONFIGURATION_DEFINITION_INVALID` for a
 *   malformed legacy/schema entry and provider-specific schema errors for an
 *   unsupported schema value.
 */
export function assertConfigEntry(value: unknown, location: SchemaLocation): void {
  if (!is.object(value)) {
    throw schemaException(location, "CONFIGURATION_DEFINITION_INVALID", "definition is malformed");
  }
  const record = value as Record<PropertyKey, unknown>;
  const hasType = Object.hasOwn(record, "type");
  const hasSchema = Object.hasOwn(record, "schema");
  if (hasType === hasSchema) {
    throw schemaException(
      location,
      "CONFIGURATION_DEFINITION_INVALID",
      "definition must provide exactly one of type or schema",
    );
  }
  if (hasType) {
    if (!is.string(record.type) || !PROJECT_CONFIG_TYPES.has(record.type as ProjectConfigTypes)) {
      throw schemaException(
        location,
        "CONFIGURATION_DEFINITION_INVALID",
        "legacy type is unsupported",
      );
    }
    return;
  }
  if (is.undefined(record.schema) || record.schema === null) {
    throw schemaException(location, "CONFIGURATION_DEFINITION_INVALID", "schema is missing");
  }
  if (Object.hasOwn(record, "default") || Object.hasOwn(record, "description")) {
    throw schemaException(
      location,
      "CONFIGURATION_DEFINITION_INVALID",
      "schema metadata must be declared on the schema",
    );
  }
  getSchemaProvider(record.schema, location);
}
