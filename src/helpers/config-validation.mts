// cspell:words typebox zod
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
 * @throws {BootstrapException} `CONFIG_SCHEMA_UNSUPPORTED` or
 *   `CONFIG_SCHEMA_AMBIGUOUS` when dispatch cannot identify one provider,
 *   `CONFIG_SCHEMA_PROVIDER_UNSUPPORTED` for an unsupported Zod surface,
 *   `CONFIG_SCHEMA_PEER_MISSING` or `CONFIG_SCHEMA_PEER_BROKEN` when TypeBox
 *   cannot be loaded, `CONFIG_SCHEMA_INVALID` when validation fails, and
 *   `CONFIG_SCHEMA_PROCESSING_FAILED` when provider processing fails.
 */
export async function processSchemaValue(
  schema: ConfigSchema,
  value: unknown,
  location: SchemaLocation,
): Promise<unknown> {
  const provider = getSchemaProvider(schema, location);
  switch (provider) {
    case "typebox":
      return processTypeBoxValue(schema, value, location);
    case "zod":
      return processZodValue(schema, value, location);
    default:
      return processStandardValue(schema, value, location);
  }
}

/**
 * Validate a configuration entry's runtime discriminator and schema shape.
 *
 * @throws {BootstrapException} `CONFIGURATION_DEFINITION_INVALID` for a
 *   malformed legacy/schema entry, `CONFIG_SCHEMA_UNSUPPORTED` for an
 *   unsupported schema value, and `CONFIG_SCHEMA_AMBIGUOUS` when a schema
 *   exposes multiple providers.
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
  if (Object.hasOwn(record, "required")) {
    throw schemaException(
      location,
      "CONFIGURATION_DEFINITION_INVALID",
      "schema entries cannot declare required",
    );
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
