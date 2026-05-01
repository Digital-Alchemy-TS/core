import { randomBytes } from "node:crypto";
import { isDeepStrictEqual, types } from "node:util";

import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

import type { TBlackHole, TContext } from "../index.mts";
import { EMPTY, EVEN } from "../index.mts";

type MaybeEmptyTypes =
  | string
  | undefined
  | Array<unknown>
  | number
  | Set<unknown>
  | Map<unknown, unknown>
  | object;

type MaybeFunction = (...parameters: unknown[]) => TBlackHole;

/**
 * Type guard and basic utility class for runtime type testing.
 *
 * @remarks
 * Provides a unified API for type narrowing, equality, emptiness checks, and
 * basic conversions. All methods are designed as type guards where applicable
 * (e.g., `array()`, `string()` narrow their arguments) and simple predicates
 * elsewhere (e.g., `even()`, `empty()`). The singleton `is` instance is
 * imported directly in lifecycle and wiring services to avoid circular
 * dependencies; everywhere else it is accessed via `internal.utils.is`.
 */
export class IsIt {
  /**
   * Test whether a value is an array.
   */
  public array<T>(test: unknown): test is Array<T> {
    return Array.isArray(test);
  }

  /**
   * Test whether a value is a boolean.
   */
  public boolean(test: unknown): test is boolean {
    return typeof test === "boolean";
  }

  /**
   * Test whether a value is a valid context (branded string).
   *
   * @remarks
   * The internals of this test may get more creative as context evolves;
   * currently a simple string type guard.
   */
  public context(test: unknown): test is TContext {
    return typeof test === "string";
  }

  /**
   * Test whether a value is a valid Date object.
   *
   * @remarks
   * Checks both that the value is a Date and that its time is a valid number;
   * this filters out invalid Date instances like `new Date(NaN)`.
   */
  public date(test: unknown): test is Date {
    return types.isDate(test) && is.number(test.getTime());
  }

  /**
   * Test whether a value is a valid dayjs instance.
   */
  public dayjs(test: unknown): test is Dayjs {
    return test instanceof dayjs && (test as Dayjs).isValid();
  }

  /**
   * Test whether a value is empty: undefined, zero-length, zero size, or empty object.
   *
   * @throws When the input type is not recognized (string, array, Map, Set, object, number, undefined).
   */
  public empty(test: MaybeEmptyTypes): boolean {
    if (test === undefined) {
      // undefined is always empty
      return true;
    }
    if (typeof test === "string" || Array.isArray(test)) {
      return test.length === EMPTY;
    }
    if (types.isMap(test) || types.isSet(test)) {
      return test.size === EMPTY;
    }
    if (typeof test === "object") {
      // walk the object to detect whether any own properties exist
      for (const key in test) {
        if (Object.prototype.hasOwnProperty.call(test, key)) {
          return false;
        }
      }
      return true;
    }
    if (typeof test === "number") {
      // NaN is the only number that is empty
      return Number.isNaN(test);
    }
    // unsupported type — reject rather than silently pass
    throw new Error("Unsupported type " + typeof test);
  }

  /**
   * #MARK: Deep equality test
   */
  /**
   * Test whether two values are deeply equal using strict comparison.
   */
  public equal<T extends unknown>(a: T, b: T): boolean {
    return isDeepStrictEqual(a, b);
  }

  /**
   * Test whether a number is even.
   */
  public even(test: number): boolean {
    return test % EVEN === EMPTY;
  }

  /**
   * Test whether a value is a function.
   */
  public function<T extends MaybeFunction>(test: unknown): test is T {
    return typeof test === "function";
  }

  /**
   * Test whether a value is a valid number (not NaN).
   */
  public number(test: unknown): test is number {
    return typeof test === "number" && !Number.isNaN(test);
  }

  /**
   * Test whether a value is a plain object (not an array or null).
   */
  public object(test: unknown): test is object {
    return typeof test === "object" && test !== null && !Array.isArray(test);
  }

  /**
   * Return a random element from the provided list.
   */
  public random<T>(list: T[]): T {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return list[Math.floor(randomBytes(1)[0] % list.length)];
  }

  /**
   * Test whether a value is a string.
   */
  public string(test: unknown): test is string {
    return typeof test === "string";
  }

  /**
   * Test whether a value is a symbol.
   */
  public symbol(test: unknown): test is symbol {
    return typeof test === "symbol";
  }

  /**
   * Test whether a value is undefined.
   */
  public undefined(test: unknown): test is undefined {
    return test === undefined;
  }

  /**
   * Return a new array containing unique items from the input (deduplication).
   */
  public unique<T>(items: T[]): T[] {
    return [...new Set(items)];
  }
}

export const is = new IsIt();
