import { is } from "../index.mts";

function isSpecificValue(value: unknown) {
  return value instanceof Date || value instanceof RegExp;
}

export function cloneSpecificValue(value: unknown) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (value instanceof RegExp) {
    return new RegExp(value);
  }
  throw new TypeError("Unexpected situation");
}

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

export function safeGetProperty(object: unknown, key: string) {
  return key === "__proto__" ? undefined : (object as Record<string, unknown>)[key];
}

export function deepExtend<A, B>(target: A, object: B): A & B {
  if (!is.object(object)) {
    return target as A & B;
  }
  Object.keys(object).forEach(key => {
    const source = safeGetProperty(target, key);
    const value = safeGetProperty(object, key);
    if (value === target) {
      return;
    }
    if (typeof value !== "object" || value === null) {
      (target as Record<string, unknown>)[key] = value;
      return;
    }
    if (is.array(value)) {
      (target as Record<string, unknown>)[key] = deepCloneArray(value);
      return;
    }
    if (isSpecificValue(value)) {
      (target as Record<string, unknown>)[key] = cloneSpecificValue(value);
      return;
    }
    if (typeof source !== "object" || source === null || is.array(source)) {
      (target as Record<string, unknown>)[key] = deepExtend({}, value);
      return;
    }
    (target as Record<string, unknown>)[key] = deepExtend(source, value);
  });
  return target as A & B;
}
