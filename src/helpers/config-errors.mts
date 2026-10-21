import { is } from "../index.mts";
import type { SchemaProvider } from "./config-types.mts";
import type { TContext } from "./context.mts";
import { BootstrapException } from "./errors.mts";

/** Options identifying a config key in a contextual bootstrap diagnostic. */
export type SchemaLocation = {
  context: TContext;
  property: string;
  project: string;
};

function safeIdentifier(value: unknown): string {
  if (is.string(value) && /^[A-Za-z0-9_.-]+$/.test(value)) {
    return value;
  }
  return "<unknown>";
}

function locationText({ project, property }: SchemaLocation): string {
  return `${safeIdentifier(project)}.${safeIdentifier(property)}`;
}

/** Create a sanitised contextual schema bootstrap error. */
export function schemaException(
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

/**
 * Throw a sanitised validation failure for a provider result.
 *
 * @throws {BootstrapException} Always throws `CONFIG_SCHEMA_INVALID`.
 * @internal
 */
export function validationFailure(
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

/**
 * Throw a sanitised provider processing failure.
 *
 * @throws {BootstrapException} Always throws `CONFIG_SCHEMA_PROCESSING_FAILED`.
 * @internal
 */
export function processingFailure(location: SchemaLocation, provider: SchemaProvider): never {
  throw schemaException(
    location,
    "CONFIG_SCHEMA_PROCESSING_FAILED",
    `${provider} processing failed`,
  );
}

/**
 * Execute a synchronous provider callback behind the contextual error boundary.
 *
 * @throws {BootstrapException} `CONFIG_SCHEMA_PROCESSING_FAILED` when the
 *   provider callback throws.
 * @internal
 */
export function providerCall<OUTPUT>(
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

/**
 * Execute an asynchronous provider callback behind the contextual error boundary.
 *
 * @throws {BootstrapException} `CONFIG_SCHEMA_PROCESSING_FAILED` when the
 *   provider callback throws or rejects.
 * @internal
 */
export async function providerCallAsync<OUTPUT>(
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
