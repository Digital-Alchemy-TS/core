import { is } from "../index.mts";
import type { SchemaLocation } from "./config-errors.mts";
import type {
  SchemaDefaultMetadata,
  SchemaMetadata,
  SerializableMetadata,
} from "./config-types.mts";
import { getSchemaProvider } from "./config-validation.mts";

/**
 * Project a metadata value into the supported JSON-like metadata subset.
 *
 * @remarks
 * Unsupported values, non-finite numbers, and cycles are omitted rather than
 * executing user code or inventing a representation for the value.
 * @internal
 */
// eslint-disable-next-line sonarjs/function-return-type -- unsupported metadata intentionally returns `undefined`.
function serializeMetadata(
  value: unknown,
  seen = new Set<object>(),
): SerializableMetadata | undefined {
  if (value === null) {
    return null;
  }
  if (is.boolean(value) || is.string(value)) {
    return value;
  }
  if (is.number(value)) {
    return Number.isFinite(value) ? value : undefined;
  }
  if (is.array(value)) {
    if (seen.has(value)) {
      return undefined;
    }
    seen.add(value);
    const result = value.map(item => serializeMetadata(item, seen));
    return result.every(item => !is.undefined(item))
      ? (result as SerializableMetadata[])
      : undefined;
  }
  if (!is.object(value) || seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  const result: Record<string, SerializableMetadata> = {};
  const record = value as Record<string, unknown>;
  const valid = Object.keys(record).every(key => {
    const item = serializeMetadata(record[key], seen);
    if (is.undefined(item)) {
      return false;
    }
    result[key] = item;
    return true;
  });
  return valid ? result : undefined;
}

/** Read a static default for metadata without invoking a factory. */
export function getDefaultMetadata(value: unknown): SchemaDefaultMetadata {
  if (is.function(value)) {
    return { kind: "dynamic" };
  }
  const serialized = serializeMetadata(value);
  return serialized === undefined ? { kind: "unknown" } : { kind: "static", value: serialized };
}

function defaultMetadata(schema: Record<PropertyKey, unknown>): SchemaDefaultMetadata | undefined {
  return Object.hasOwn(schema, "default") ? getDefaultMetadata(schema.default) : undefined;
}

/**
 * Read safe schema metadata without evaluating defaults or provider callbacks.
 *
 * @throws {BootstrapException} `CONFIG_SCHEMA_UNSUPPORTED` or
 *   `CONFIG_SCHEMA_AMBIGUOUS` when the schema provider surface is invalid.
 */
export function getSchemaMetadata(schema: unknown, location: SchemaLocation): SchemaMetadata {
  const provider = getSchemaProvider(schema, location);
  const record = schema as Record<PropertyKey, unknown>;
  const metadata: {
    default?: SchemaDefaultMetadata;
    description?: string;
    examples?: SerializableMetadata;
    provider: SchemaMetadata["provider"];
    title?: string;
  } = { provider };
  if (is.string(record.title)) {
    metadata.title = record.title;
  }
  if (is.string(record.description)) {
    metadata.description = record.description;
  }
  if (Object.hasOwn(record, "examples")) {
    const examples = serializeMetadata(record.examples);
    if (!is.undefined(examples)) {
      metadata.examples = examples;
    }
  }
  const defaultValue = defaultMetadata(record);
  if (defaultValue) {
    metadata.default = defaultValue;
  }
  return metadata;
}
