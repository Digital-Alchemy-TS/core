import { is } from "../extensions/is.extension.mjs";

describe("is", () => {
  describe("array method", () => {
    it("identifies arrays", () => {
      expect(is.array([])).toBe(true);
      expect(is.array([1, 2, 3])).toBe(true);
    });
    it("identifies non-arrays", () => {
      expect(is.array("string")).toBe(false);
      expect(is.array({})).toBe(false);
    });
  });

  describe("boolean method", () => {
    it("identifies booleans", () => {
      expect(is.boolean(true)).toBe(true);
      expect(is.boolean(false)).toBe(true);
    });
    it("identifies non-booleans", () => {
      expect(is.boolean(0)).toBe(false);
      expect(is.boolean(null)).toBe(false);
    });
  });

  describe("date method", () => {
    it("identifies dates", () => {
      expect(is.date(new Date())).toBe(true);
    });
    it("identifies non-dates", () => {
      expect(is.date("2020-01-01")).toBe(false);
      expect(is.date(1_577_836_800_000)).toBe(false);
    });
  });

  describe("empty method", () => {
    it("identifies empty values", () => {
      expect(is.empty("")).toBe(true);
      expect(is.empty([])).toBe(true);
      expect(is.empty({})).toBe(true);
      expect(is.empty(new Set())).toBe(true);
      expect(is.empty(new Map())).toBe(true);
    });
    it("identifies non-empty values", () => {
      expect(is.empty("not empty")).toBe(false);
      expect(is.empty([1, 2, 3])).toBe(false);
      expect(is.empty({ key: "value" })).toBe(false);
      expect(is.empty(new Set([1]))).toBe(false);
      expect(is.empty(new Map([["key", "value"]]))).toBe(false);
    });
  });

  describe("equal method", () => {
    it("identifies equal values", () => {
      expect(is.equal(5, 5)).toBe(true);
      expect(is.equal("string", "string")).toBe(true);
      expect(is.equal([1, 2], [1, 2])).toBe(true);
    });
    it("identifies non-equal values", () => {
      expect(is.equal(5, 10)).toBe(false);
      expect(is.equal("string", "another string")).toBe(false);
      expect(is.equal([1, 2], [2, 1])).toBe(false);
    });
  });

  describe("even method", () => {
    it("identifies even numbers", () => {
      expect(is.even(2)).toBe(true);
      expect(is.even(4)).toBe(true);
    });
    it("identifies non-even numbers", () => {
      expect(is.even(1)).toBe(false);
      expect(is.even(3)).toBe(false);
    });
  });

  describe("function method", () => {
    it("identifies functions", () => {
      expect(is.function(() => {})).toBe(true);
      expect(is.function(function () {})).toBe(true);
    });
    it("identifies non-functions", () => {
      expect(is.function(123)).toBe(false);
      expect(is.function("string")).toBe(false);
    });
  });

  describe("hash method", () => {
    it("generates consistent hash", () => {
      const text = "test string";
      const hash1 = is.hash(text);
      const hash2 = is.hash(text);
      expect(hash1).toBe(hash2);
    });
  });

  describe("number method", () => {
    it("identifies numbers", () => {
      expect(is.number(123)).toBe(true);
      expect(is.number(-123)).toBe(true);
    });
    it("identifies non-numbers", () => {
      expect(is.number("123")).toBe(false);
      expect(is.number(null)).toBe(false);
    });
  });

  describe("object method", () => {
    it("identifies objects", () => {
      expect(is.object({})).toBe(true);
      expect(is.object(new Date())).toBe(true);
    });
    it("identifies non-objects", () => {
      expect(is.object(123)).toBe(false);
      expect(is.object("string")).toBe(false);
    });
  });

  describe("random method", () => {
    it("returns an element from the array", () => {
      const array = [1, 2, 3];
      const randomElement = is.random(array);
      expect(array).toContain(randomElement);
    });
  });

  describe("string method", () => {
    it("identifies strings", () => {
      expect(is.string("string")).toBe(true);
      expect(is.string("")).toBe(true);
    });
    it("identifies non-strings", () => {
      expect(is.string(123)).toBe(false);
      expect(is.string(null)).toBe(false);
    });
  });

  describe("symbol method", () => {
    it("identifies symbols", () => {
      expect(is.symbol(Symbol("symbol"))).toBe(true);
    });
    it("identifies non-symbols", () => {
      expect(is.symbol("symbol")).toBe(false);
      expect(is.symbol(123)).toBe(false);
    });
  });

  describe("undefined method", () => {
    it("identifies undefined", () => {
      expect(is.undefined(undefined)).toBe(true);
    });
    it("identifies defined values", () => {
      expect(is.undefined(null)).toBe(false);
      expect(is.undefined(0)).toBe(false);
    });
  });

  describe("unique method", () => {
    it("removes duplicates from an array", () => {
      const array = [1, 1, 2, 2, 3, 3];
      const uniqueArray = is.unique(array);
      expect(uniqueArray).toEqual([1, 2, 3]);
    });
  });
});
