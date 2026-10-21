// cspell:words typebox
import { createRequire } from "node:module";

import { is } from "../index.mts";
import {
  providerCall,
  schemaException,
  type SchemaLocation,
  validationFailure,
} from "./config-errors.mts";
import type { ConfigSchema, SupportedTypeBoxSchema } from "./config-types.mts";

const NO_VALIDATION_ERRORS = 0;
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

type TypeBoxValueModule = {
  Clone: (value: unknown) => unknown;
  Convert: (type: unknown, value: unknown) => unknown;
  DecodeUnsafe: (context: Record<string, never>, type: unknown, value: unknown) => unknown;
  Default: (type: unknown, value: unknown) => unknown;
  Errors: (type: unknown, value: unknown) => readonly unknown[];
};

function isTypeBoxJsonSchemaShape(value: Record<PropertyKey, unknown>): boolean {
  const type = value.type;
  if (is.string(type) && TYPEBOX_SCHEMA_TYPES.has(type)) {
    return true;
  }
  return (
    is.string(value.$ref) ||
    is.array(value.anyOf) ||
    is.array(value.allOf) ||
    is.object(value.not) ||
    Object.hasOwn(value, "const") ||
    is.array(value.enum) ||
    is.object(value.properties) ||
    Object.hasOwn(value, "items")
  );
}

function isTypeBoxKindShape(kind: string, value: Record<PropertyKey, unknown>): boolean {
  const type = TYPEBOX_KIND_TYPES.get(kind);
  if (!is.undefined(type) && value.type !== type) {
    return false;
  }
  switch (kind) {
    case "Any":
    case "Unknown":
      return [...TYPEBOX_KINDLESS_KEYS].every(key => !Object.hasOwn(value, key));
    case "Array":
      return is.object(value.items);
    case "Constructor":
      return is.array(value.parameters) && is.object(value.instanceType);
    case "Cyclic":
      return is.string(value.$ref) && is.object(value.$defs);
    case "Enum":
      return is.array(value.enum) && value.enum.length > NO_VALIDATION_ERRORS;
    case "Function":
      return is.array(value.parameters) && is.object(value.returnType);
    case "Intersect":
      return is.array(value.allOf) && value.allOf.length > NO_VALIDATION_ERRORS;
    case "Literal":
      return (
        Object.hasOwn(value, "const") &&
        ((value.type === "boolean" && is.boolean(value.const)) ||
          (value.type === "number" && is.number(value.const)) ||
          (value.type === "string" && is.string(value.const)))
      );
    case "Never":
    case "Not":
      return is.object(value.not);
    case "Object":
      return is.object(value.properties);
    case "Record":
      return is.object(value.patternProperties);
    case "Ref":
      return is.string(value.$ref);
    case "Rest":
      return is.array(value.items);
    case "TemplateLiteral":
      return is.string(value.pattern);
    case "This":
      return is.string(value.$ref);
    case "Tuple":
      return is.array(value.items);
    case "Union":
      return is.array(value.anyOf) && value.anyOf.length > NO_VALIDATION_ERRORS;
    default:
      return !is.undefined(type);
  }
}

/** @internal — identify a TypeBox marker without accepting malformed schemas. */
export function hasTypeBoxSchemaMarker(value: unknown): value is SupportedTypeBoxSchema {
  if (!is.object(value)) {
    return false;
  }
  const record = value as Record<PropertyKey, unknown>;
  if (Object.hasOwn(record, "~kind")) {
    const kind = record["~kind"];
    return is.string(kind) && !Object.hasOwn(record, "~unsafe") && isTypeBoxKindShape(kind, record);
  }
  return (
    Object.hasOwn(record, "~unsafe") &&
    record["~unsafe"] === null &&
    isTypeBoxJsonSchemaShape(record)
  );
}

/** Return true when a value has a recognised TypeBox factory marker. */
export function isSupportedTypeBoxSchema(value: unknown): value is SupportedTypeBoxSchema {
  return hasTypeBoxSchemaMarker(value) && !("~standard" in value);
}

/** @internal — classify resolver failures without exposing provider error text. */
export function classifyTypeBoxPeerFailure(error: unknown): "broken" | "missing" {
  if (!is.object(error)) {
    return "broken";
  }
  const record = error as Record<PropertyKey, unknown>;
  if (record.code !== "ERR_MODULE_NOT_FOUND" && record.code !== "MODULE_NOT_FOUND") {
    return "broken";
  }
  return is.string(record.message) &&
    /Cannot find (?:module|package) ['"]typebox['"]/.test(record.message)
    ? "missing"
    : "broken";
}

function resolveTypeBoxPeer(): "available" | "broken" | "missing" {
  try {
    createRequire(import.meta.url).resolve("typebox");
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

  let loaded: unknown;
  try {
    loaded = await import("typebox/value");
  } catch {
    throw schemaException(
      location,
      "CONFIG_SCHEMA_PEER_BROKEN",
      "requires a compatible 'typebox/value' peer",
    );
  }
  if (!is.object(loaded)) {
    throw schemaException(
      location,
      "CONFIG_SCHEMA_PEER_BROKEN",
      "requires a compatible 'typebox/value' peer",
    );
  }
  const module = loaded as Record<PropertyKey, unknown>;
  if (
    !is.function(module.Clone) ||
    !is.function(module.Convert) ||
    !is.function(module.DecodeUnsafe) ||
    !is.function(module.Default) ||
    !is.function(module.Errors)
  ) {
    throw schemaException(
      location,
      "CONFIG_SCHEMA_PEER_BROKEN",
      "requires a compatible 'typebox/value' peer",
    );
  }
  return module as unknown as TypeBoxValueModule;
}

/**
 * Process one TypeBox-backed configuration value.
 *
 * @throws {BootstrapException} `CONFIG_SCHEMA_PEER_MISSING` when TypeBox is not
 *   installed, `CONFIG_SCHEMA_PEER_BROKEN` when its value module is unusable,
 *   `CONFIG_SCHEMA_REQUIRED` when a required output is missing,
 *   `CONFIG_SCHEMA_INVALID` when native validation rejects the value, and
 *   `CONFIG_SCHEMA_PROCESSING_FAILED` when a native provider operation throws.
 * @internal
 */
export async function processTypeBoxValue(
  schema: ConfigSchema,
  value: unknown,
  required: boolean,
  location: SchemaLocation,
): Promise<unknown> {
  const typeBox = await loadTypeBoxValue(location);
  const wasMissing = is.undefined(value);
  const candidate = providerCall(location, "typebox", () => typeBox.Clone(value));
  const defaulted = providerCall(location, "typebox", () => typeBox.Default(schema, candidate));
  // TypeBox clones static defaults but intentionally returns factory results as-is;
  // clone the completed candidate once more so provider-owned mutable defaults
  // cannot become the live configuration object.
  const isolated = providerCall(location, "typebox", () => typeBox.Clone(defaulted));
  const converted =
    wasMissing && is.undefined(isolated)
      ? isolated
      : providerCall(location, "typebox", () => typeBox.Convert(schema, isolated));
  const errors = providerCall(location, "typebox", () => typeBox.Errors(schema, converted));
  if (errors.length > NO_VALIDATION_ERRORS) {
    validationFailure(location, "typebox", errors.length);
  }
  const output = providerCall(location, "typebox", () =>
    typeBox.DecodeUnsafe({}, schema, converted),
  );
  if (required && is.undefined(output)) {
    throw schemaException(location, "CONFIG_SCHEMA_REQUIRED", "output is missing");
  }
  return output;
}
