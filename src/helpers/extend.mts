/**
 * Deep object merging and cloning utilities — recursive extend and array clone
 * functions that preserve Date and RegExp instances.
 *
 * @remarks
 * These utilities support the configuration system by enabling deep merging of
 * config objects from multiple sources while preserving special value types.
 * `deepExtend` mutates the target in place and returns it; `deepCloneArray`
 * creates a new array with recursively cloned items.
 */

import { is } from "../index.mts";

/**
 * Check whether a value is a Date or RegExp instance.
 *
 * @internal
 */
function isSpecificValue(value: unknown) {
  return value instanceof Date || value instanceof RegExp;
}

/**
 * Clone a Date or RegExp instance.
 *
 * @remarks
 * Creates a new Date or RegExp with the same value as the input. Throws
 * TypeError if the input is neither a Date nor a RegExp.
 *
 * @throws {TypeError} when the value is not a Date or RegExp.
 *
 * @internal
 */
export function cloneSpecificValue(value: unknown) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (value instanceof RegExp) {
    return new RegExp(value);
  }
  throw new TypeError("Unexpected situation");
}

/**
 * Recursively clone an array, preserving nested objects, arrays, Dates, and RegExps.
 *
 * @remarks
 * Walks the array and clones each item: arrays are cloned recursively, Dates and
 * RegExps are cloned using `cloneSpecificValue`, plain objects are merged with
 * an empty target using `deepExtend`, and primitives are returned as-is.
 */
export function deepCloneArray<TYPE = unknown>(array: Array<TYPE>): Array<TYPE> {
  // eslint-disable-next-line sonarjs/function-return-type
  return array.map(item => {
    if (is.array(item)) {
      return deepCloneArray(item);
    }
    if (isSpecificValue(item)) {
      return cloneSpecificValue(item);
    }
    if (is.object(item)) {
      return deepExtend({}, item);
    }
    return item;
  }) as Array<TYPE>;
}

/**
 * Safely read a property from an object, blocking access to `__proto__`.
 *
 * @remarks
 * Returns `undefined` if the key is `__proto__`, otherwise returns the value at
 * `object[key]`. This prevents prototype pollution vulnerabilities during deep
 * merges.
 *
 * @internal
 */
export function safeGetProperty(object: unknown, key: string) {
  // guard against prototype pollution
  return key === "__proto__" ? undefined : (object as Record<string, unknown>)[key];
}

/**
 * Merge all own properties from `object` into `target`, recursively.
 *
 * @remarks
 * Mutates `target` in place and returns the merged result. Primitive values
 * overwrite target properties outright. Arrays from `object` are cloned into
 * the target. Objects are recursively merged if both target and source values
 * are plain objects; otherwise, a new deep clone is created. Dates and RegExps
 * are cloned. Circular references (where `value === target`) are skipped to
 * prevent infinite recursion.
 */
export function deepExtend<A, B>(target: A, object: B): A & B {
  // early exit if not merging an object
  if (!is.object(object)) {
    return target as A & B;
  }
  Object.keys(object).forEach(key => {
    const source = safeGetProperty(target, key);
    const value = safeGetProperty(object, key);
    // skip circular references
    if (value === target) {
      return;
    }
    // scalars and nulls overwrite directly
    if (typeof value !== "object" || value === null) {
      (target as Record<string, unknown>)[key] = value;
      return;
    }
    // arrays are cloned into the target
    if (is.array(value)) {
      (target as Record<string, unknown>)[key] = deepCloneArray(value);
      return;
    }
    // special values (Date, RegExp) are cloned
    if (isSpecificValue(value)) {
      (target as Record<string, unknown>)[key] = cloneSpecificValue(value);
      return;
    }
    // if source is not an object or is an array, create a new clone of value
    if (typeof source !== "object" || source === null || is.array(source)) {
      (target as Record<string, unknown>)[key] = deepExtend({}, value);
      return;
    }
    // both are plain objects — recurse
    (target as Record<string, unknown>)[key] = deepExtend(source, value);
  });
  return target as A & B;
}
