import { TestRunner } from "./helpers";

describe("ALS", () => {
  it("exists", async () => {
    expect.assertions(1);
    await TestRunner().run(({ als }) => {
      expect(als).toBeDefined();
    });
  });
});
