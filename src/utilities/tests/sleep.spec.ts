import { PEAT } from "../helpers/utilities.helper";

describe("PEAT function", () => {
  it("creates an array of the specified length", () => {
    const length = 5;
    const array = PEAT(length);
    expect(array.length).toBe(length);
  });

  it("fills the array with the specified value", () => {
    const fillValue = "test";
    const array = PEAT(3, fillValue);
    expect(array).toEqual([fillValue, fillValue, fillValue]);
  });

  it("fills the array with index + 1 if no fill value is provided", () => {
    const length = 3;
    const array = PEAT(length);
    expect(array).toEqual([1, 2, 3]);
  });
});
