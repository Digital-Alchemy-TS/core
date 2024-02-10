import { deepEqual } from "assert";

import { EMPTY, EVEN, NONE, START, TBlackHole, TContext } from "../helpers";

type MaybeEmptyTypes =
  | string
  | undefined
  | Array<unknown>
  | Set<unknown>
  | Map<unknown, unknown>
  | object;

type MaybeFunction = (...parameters: unknown[]) => TBlackHole;

const HASH_PRIME_MULTIPLIER = 31;

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

  public date(test: unknown): test is Date {
    return test instanceof Date;
  }

  public empty(test: MaybeEmptyTypes): boolean {
    if (test === undefined) {
      return true;
    }
    if (typeof test === "string" || Array.isArray(test)) {
      return test.length === EMPTY;
    }
    if (test instanceof Map || test instanceof Set) {
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
    // Optional: Throw an error or return a default value for unsupported types
    throw new Error("Unsupported type");
  }

  /**
   * ### Deep equality test
   */
  public equal<T extends unknown>(a: T, b: T): boolean {
    try {
      deepEqual(a, b);
      return true;
    } catch {
      return false;
    }
  }

  public even(test: number): boolean {
    return test % EVEN === EMPTY;
  }

  public function<T extends MaybeFunction>(test: unknown): test is T {
    return typeof test === "function";
  }

  /**
   * Generates a hash code for a string, based on the Java String hash function.
   * It iterates through the characters of the string, combining the ASCII values
   * with a prime multiplier to create a unique hash value.
   * This method can be useful for creating a simple, consistent hash code.
   */
  public hash(text: string): string {
    let hash = START;
    for (let i = START; i < text.length; i++) {
      hash =
        (hash << HASH_PRIME_MULTIPLIER) - hash + (text.codePointAt(i) || NONE);
      hash = Math.trunc(hash);
    }
    return hash.toString();
  }

  public number(test: unknown): test is number {
    return typeof test === "number" && !Number.isNaN(test);
  }

  public object(test: unknown): test is object {
    return typeof test === "object" && test !== null && !Array.isArray(test);
  }

  public random<T>(list: T[]): T {
    return list[Math.floor(Math.random() * list.length)];
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
