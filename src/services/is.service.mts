import { randomBytes } from "crypto";
import dayjs, { Dayjs } from "dayjs";
import { isDeepStrictEqual, types } from "util";

import { EMPTY, EVEN, TBlackHole, TContext } from "../index.mjs";

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
 * type testing and basic conversion tools
 */
export class IsIt {
  public array(test: unknown): test is Array<unknown> {
    return Array.isArray(test);
  }

  public boolean(test: unknown): test is boolean {
    return typeof test === "boolean";
  }

  /**
   * The internals of this test may get more creative as context evolves
   */
  public context(test: unknown): test is TContext {
    return typeof test === "string";
  }

  /**
   * test is valid date
   */
  public date(test: unknown): test is Date {
    return types.isDate(test) && is.number(test.getTime());
  }

  public dayjs(test: unknown): test is Dayjs {
    return test instanceof dayjs && (test as Dayjs).isValid();
  }

  public empty(test: MaybeEmptyTypes): boolean {
    if (test === undefined) {
      return true;
    }
    if (typeof test === "string" || Array.isArray(test)) {
      return test.length === EMPTY;
    }
    if (types.isMap(test) || types.isSet(test)) {
      return test.size === EMPTY;
    }
    if (typeof test === "object") {
      for (const key in test) {
        if (Object.prototype.hasOwnProperty.call(test, key)) {
          return false;
        }
      }
      return true;
    }
    if (typeof test === "number") {
      return Number.isNaN(test);
    }
    // Optional: Throw an error or return a default value for unsupported types
    throw new Error("Unsupported type " + typeof test);
  }

  /**
   * #MARK: Deep equality test
   */
  public equal<T extends unknown>(a: T, b: T): boolean {
    return isDeepStrictEqual(a, b);
  }

  public even(test: number): boolean {
    return test % EVEN === EMPTY;
  }

  public function<T extends MaybeFunction>(test: unknown): test is T {
    return typeof test === "function";
  }

  public number(test: unknown): test is number {
    return typeof test === "number" && !Number.isNaN(test);
  }

  public object(test: unknown): test is object {
    return typeof test === "object" && test !== null && !Array.isArray(test);
  }

  public random<T>(list: T[]): T {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return list[Math.floor(randomBytes(1)[0] % list.length)];
  }

  public string(test: unknown): test is string {
    return typeof test === "string";
  }

  public symbol(test: unknown): test is symbol {
    return typeof test === "symbol";
  }

  public undefined(test: unknown): test is undefined {
    return test === undefined;
  }

  public unique<T>(items: T[]): T[] {
    return [...new Set(items)];
  }
}

export const is = new IsIt();
