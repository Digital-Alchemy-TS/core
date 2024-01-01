import deepEqual from "deep-equal";

import { EMPTY, EVEN, START } from "./utilities";

type MaybeEmptyTypes =
  | string
  | Array<unknown>
  | Set<unknown>
  | Map<unknown, unknown>
  | object;

type MaybeFunction = (
  ...parameters: unknown[]
) => unknown | void | Promise<unknown | void>;

// TODO: declaration merging to allow other libs to create definitions here
/**
 * type testing and basic conversion tools
 */
export class DigitalAlchemyIs {
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

  /**
   * Wrapper for `deep-equal`
   */
  public equal(a: unknown, b: unknown): boolean {
    return deepEqual(a, b);
  }

  public even(test: number): boolean {
    return test % EVEN === EMPTY;
  }

  public function<T extends MaybeFunction>(test: unknown): test is T {
    return typeof test === "function";
  }

  public hash(text: string): string {
    let hash = START;
    for (let i = START; i < text.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      hash = (hash << 5) - hash + text.codePointAt(i);
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
    // Technically this isn't an "is"... but close enough
    return out.filter((item, index, array) => array.indexOf(item) === index);
  }
}
export const is = new DigitalAlchemyIs();
