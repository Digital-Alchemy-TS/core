import { TestRunner } from "./helpers";

describe("Lifecycle", () => {
  it("auto runs late attach", async () => {
    await TestRunner().run(({ lifecycle }) => {
      lifecycle.onBootstrap(async () => {
        const spy = jest.fn();
        await new Promise<void>((done) => {
          lifecycle.onPreInit(() => {
            spy();
            done();
          });
        });
        expect(spy).toHaveBeenCalled();
      });
    });
  });
});
