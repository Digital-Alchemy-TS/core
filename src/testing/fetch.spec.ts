import { CreateApplication, is } from "..";
import { BASIC_BOOT, ServiceTest } from "./testing.helper";

describe("Fetch Extension", () => {
  // * DO NOT REMOVE THIS BLOCK
  beforeAll(async () => {
    // It does nothing, but somehow magically prevents jest from exploding for no reason
    // @ts-expect-error asdf
    const preload = CreateApplication({ name: "testing" });
    await preload.bootstrap(BASIC_BOOT);
    await preload.teardown();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("Creation", () => {
    it("should initialize properly", async () => {
      expect.assertions(7);
      await ServiceTest(({ internal, context }) => {
        expect(internal.boilerplate.fetch).toBeDefined();
        const HEADERS = { TEST: "ing" };
        const data = internal.boilerplate.fetch({
          baseUrl: "http://foo.bar",
          context,
          headers: HEADERS,
        });
        expect(data.download).toBeDefined();
        expect(data.fetch).toBeDefined();
        expect(is.function(data.setBaseUrl)).toBe(true);
        expect(is.function(data.setHeaders)).toBe(true);
        expect(data.base_url).toBe("http://foo.bar");
        expect(data.base_headers).toBe(HEADERS);
      });
    });

    it("updates base_url", async () => {
      expect.assertions(2);
      await ServiceTest(({ internal, context }) => {
        const data = internal.boilerplate.fetch({
          baseUrl: "http://foo.bar",
          context,
        });
        expect(data.base_url).toBe("http://foo.bar");
        data.setBaseUrl("http://example.com");
        expect(data.base_url).toBe("http://example.com");
      });
    });

    it("updates headers", async () => {
      expect.assertions(2);
      await ServiceTest(({ internal, context }) => {
        const HEADERS = { TEST: "ing" };
        const UPDATE = { FOO: "ing?" };
        const data = internal.boilerplate.fetch({
          baseUrl: "http://foo.bar",
          context,
          headers: HEADERS,
        });
        expect(data.base_headers).toBe(HEADERS);
        data.setHeaders(UPDATE);
        expect(data.base_headers).toBe(UPDATE);
      });
    });
  });

  describe("execFetch", () => {
    it("measures the request", () => {
      //
    });

    it("provides a default content type for object bodies", () => {
      //
    });

    it("properly forms urls", () => {
      //
    });

    it("merges headers", () => {
      //
    });

    it("passes through method", () => {
      //
    });

    it("serializes body", () => {
      //
    });

    describe("response", () => [
      //
    ]);
  });
});
