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
 * Unsupported values, non-finite numbers, and cycles are marked unknown rather
 * than executing user code or inventing a representation for the value. Own
 * accessor properties are also omitted so metadata inspection never invokes a
 * getter.
 * @internal
 */
function serializeMetadata(value: unknown, seen = new Set<object>()): SchemaDefaultMetadata {
  if (value === null) {
    return { kind: "static", value: null };
  }
  if (is.boolean(value) || is.string(value)) {
    return { kind: "static", value };
  }
  if (is.number(value)) {
    return Number.isFinite(value) ? { kind: "static", value } : { kind: "unknown" };
  }
  if (is.array(value)) {
    if (seen.has(value)) {
      return { kind: "unknown" };
    }
    seen.add(value);
    const items = value.map(item => serializeMetadata(item, seen));
    const serializable: SerializableMetadata[] = [];
    const valid = items.every(item => {
      if (item.kind !== "static") {
        return false;
      }
      serializable.push(item.value);
      return true;
    });
    return valid ? { kind: "static", value: serializable } : { kind: "unknown" };
  }
  if (!is.object(value) || seen.has(value)) {
    return { kind: "unknown" };
  }
  seen.add(value);
  const result: Record<string, SerializableMetadata> = {};
  const record = value as Record<string, unknown>;
  const valid = Object.keys(record).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) {
      return false;
    }
    const item = serializeMetadata(descriptor.value, seen);
    if (item.kind !== "static") {
      return false;
    }
    result[key] = item.value;
    return true;
  });
  return valid ? { kind: "static", value: result } : { kind: "unknown" };
}

/** Read a static default for metadata without invoking a factory. */
export function getDefaultMetadata(value: unknown): SchemaDefaultMetadata {
  if (is.function(value)) {
    return { kind: "dynamic" };
  }
  return serializeMetadata(value);
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
    if (examples.kind === "static") {
      metadata.examples = examples.value;
    }
  }
  const defaultValue = defaultMetadata(record);
  if (defaultValue) {
    metadata.default = defaultValue;
  }
  return metadata;
}
