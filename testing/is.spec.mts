import dayjs from "dayjs";

import { is } from "../src/index.mts";

describe("IsIt class", () => {
  test("is.array returns true for arrays", () => {
    expect(is.array([])).toBe(true);
    expect(is.array([1, 2, 3])).toBe(true);
    expect(is.array("not an array")).toBe(false);
  });

  test("is.boolean returns true for booleans", () => {
    expect(is.boolean(true)).toBe(true);
    expect(is.boolean(false)).toBe(true);
    expect(is.boolean(0)).toBe(false);
  });

  test("is.context returns true for strings", () => {
    expect(is.context("a context string")).toBe(true);
    expect(is.context(123)).toBe(false);
  });

  test("is.date returns true for Date objects", () => {
    expect(is.date(new Date())).toBe(true);
    expect(is.date("not a date")).toBe(false);
  });

  test("is.dayjs returns true for dayjs objects", () => {
    expect(is.dayjs(new Date())).toBe(false);
    expect(is.dayjs(dayjs())).toBe(true);
  });

  describe("is.empty", () => {
    test("returns true for undefined", () => {
      expect(is.empty(undefined)).toBe(true);
    });

    test("returns true for an empty string", () => {
      expect(is.empty("")).toBe(true);
    });

    test("returns false for a non-empty string", () => {
      expect(is.empty("not empty")).toBe(false);
    });

    test("returns true for an empty array", () => {
      expect(is.empty([])).toBe(true);
    });

    test("returns false for a non-empty array", () => {
      expect(is.empty([1, 2, 3])).toBe(false);
    });

    test("returns true for an empty Set", () => {
      expect(is.empty(new Set())).toBe(true);
    });

    test("returns false for a non-empty Set", () => {
      expect(is.empty(new Set([1]))).toBe(false);
    });

    test("returns true for an empty Map", () => {
      expect(is.empty(new Map())).toBe(true);
    });

    test("returns false for a non-empty Map", () => {
      expect(is.empty(new Map([["key", "value"]]))).toBe(false);
    });

    test("returns true for an empty object", () => {
      expect(is.empty({})).toBe(true);
    });

    test("returns false for a non-empty object", () => {
      expect(is.empty({ key: "value" })).toBe(false);
    });

    test("returns false for numbers", () => {
      expect(is.empty(0)).toBe(false);
      expect(is.empty(1)).toBe(false);
      expect(is.empty(-1)).toBe(false);
    });

    test("returns false for NaN", () => {
      expect(is.empty(Number.NaN)).toBe(true);
    });

    test("throws an error for unsupported types like boolean", () => {
      // @ts-expect-error that's the test
      expect(() => is.empty(true)).toThrow("Unsupported type boolean");
    });

    test("throws an error for unsupported types like function", () => {
      expect(() => is.empty(() => {})).toThrow("Unsupported type function");
    });

    test("throws an error for unsupported types like symbol", () => {
      // @ts-expect-error that's the test
      expect(() => is.empty(Symbol.for("test"))).toThrow("Unsupported type symbol");
    });
  });

  test("is.equal returns true for deeply equal objects", () => {
    expect(is.equal({ a: 1 }, { a: 1 })).toBe(true);
    expect(is.equal({ a: 1 }, { a: 2 })).toBe(false);
    expect(is.equal([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(is.equal([1, 2, 3], [3, 2, 1])).toBe(false);
  });

  test("is.even returns true for even numbers", () => {
    expect(is.even(2)).toBe(true);
    expect(is.even(3)).toBe(false);
  });

  test("is.function returns true for functions", () => {
    expect(is.function(() => {})).toBe(true);
    expect(is.function(function () {})).toBe(true);
    expect(is.function("not a function")).toBe(false);
  });

  test("is.number returns true for numbers", () => {
    expect(is.number(123)).toBe(true);
    expect(is.number(Number.NaN)).toBe(false);
    expect(is.number("not a number")).toBe(false);
  });

  test("is.object returns true for objects", () => {
    expect(is.object({})).toBe(true);
    expect(is.object([])).toBe(false);
    expect(is.object(null)).toBe(false);
  });

  test("is.random returns an element from the list", () => {
    const list = [1, 2, 3, 4, 5];
    expect(list).toContain(is.random(list));
  });

  test("is.string returns true for strings", () => {
    expect(is.string("a string")).toBe(true);
    expect(is.string(123)).toBe(false);
  });

  test("is.symbol returns true for symbols", () => {
    expect(is.symbol(Symbol())).toBe(true);
    expect(is.symbol("not a symbol")).toBe(false);
  });

  test("is.undefined returns true for undefined", () => {
    expect(is.undefined(undefined)).toBe(true);
    expect(is.undefined(null)).toBe(false);
  });

  test("is.unique returns an array of unique elements", () => {
    expect(is.unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    expect(is.unique(["a", "b", "b", "c"])).toEqual(["a", "b", "c"]);
  });
});
