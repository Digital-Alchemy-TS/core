import deepEqual from "deep-equal";

import { EMPTY, EVEN, NONE, START } from "../helpers/utilities.helper.mjs";

type MaybeEmptyTypes =
  | string
  | undefined
  | Array<unknown>
  | Set<unknown>
  | Map<unknown, unknown>
  | object;

type MaybeFunction = (
  ...parameters: unknown[]
) => unknown | void | Promise<unknown | void>;

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

  public date(test: unknown): test is Date {
    return test instanceof Date;
  }

  public empty(type: MaybeEmptyTypes): boolean {
    if (is.string(type) || is.array(type)) {
      return type.length === EMPTY;
    }
    if (type instanceof Map || type instanceof Set) {
      return type.size === EMPTY;
    }
    if (is.object(type)) {
      return Object.keys(type).length === EMPTY;
    }
    return true;
  }

  public equal(a: unknown, b: unknown): boolean {
    return deepEqual(a, b);
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

  public random<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
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

  public unique<T>(out: T[]): T[] {
    return [...new Set(out)];
  }
}

export const is = new IsIt();
