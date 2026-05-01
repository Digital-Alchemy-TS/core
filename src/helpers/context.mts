/**
 * Request context — a branded string type that enables per-request logging and state isolation.
 *
 * @remarks
 * `TContext` is used throughout the framework to tag operations with a unique request
 * identifier, enabling AsyncLocalStorage to associate logs and state changes with the
 * calling context. It is passed to error constructors and used as a key in per-request
 * data structures.
 */
export type TContext = string & IContextBrand;

/**
 * Phantom brand to enforce type safety on context identifiers.
 *
 * @internal
 */
export interface IContextBrand {
  _context: symbol;
}
