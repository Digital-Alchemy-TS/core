import { CreateApplication, is } from "..";
import { BASIC_BOOT, ServiceTest } from "./testing.helper";

describe("Fetch Extension", () => {
  beforeAll(async () => {
    // @ts-expect-error testing
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
    it("provides a default content type for object bodies", async () => {
      expect.assertions(1);
      await ServiceTest(async ({ internal, context }) => {
        // @ts-expect-error testing
        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
          ok: true,
          text: jest.fn().mockResolvedValue("{}"),
        });
        const fetcher = await internal.boilerplate.fetch({
          baseUrl: "http://foo.bar",
          context,
        });

        fetcher.fetch({ body: { key: "value" }, method: "post" });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              "Content-Type": "application/json",
            }),
          }),
        );
      });
    });

    it("properly forms urls", async () => {
      expect.assertions(1);
      await ServiceTest(async ({ internal, context }) => {
        // @ts-expect-error testing
        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
          ok: true,
          text: jest.fn().mockResolvedValue("{}"),
        });
        await internal.boilerplate
          .fetch({
            baseUrl: "http://foo.bar",
            context,
          })
          .fetch({ params: { key: "value" }, url: "/endpoint" });
        expect(fetchSpy).toHaveBeenCalledWith(
          "http://foo.bar/endpoint?key=value",
          expect.any(Object),
        );
      });
    });

    it("merges headers", async () => {
      expect.assertions(1);
      await ServiceTest(async ({ internal, context }) => {
        // @ts-expect-error testing
        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
          ok: true,
          text: jest.fn().mockResolvedValue("{}"),
        });
        await internal.boilerplate
          .fetch({
            baseUrl: "http://foo.bar",
            context,
            headers: { Authorization: "Bearer token" },
          })
          .fetch({ headers: { "Custom-Header": "value" } });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer token",
              "Custom-Header": "value",
            }),
          }),
        );
      });
    });

    it("passes through method", async () => {
      expect.assertions(1);
      await ServiceTest(async ({ internal, context }) => {
        // @ts-expect-error testing
        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
          ok: true,
          text: jest.fn().mockResolvedValue("{}"),
        });
        await internal.boilerplate
          .fetch({
            baseUrl: "http://foo.bar",
            context,
          })
          .fetch({ method: "put" });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ method: "put" }),
        );
      });
    });

    it("serializes body", async () => {
      expect.assertions(1);
      await ServiceTest(async ({ internal, context }) => {
        // @ts-expect-error testing
        const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
          ok: true,
          text: jest.fn().mockResolvedValue("{}"),
        });
        await internal.boilerplate
          .fetch({
            baseUrl: "http://foo.bar",
            context,
          })
          .fetch({ body: { key: "value" } });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ body: JSON.stringify({ key: "value" }) }),
        );
      });
    });

    describe("response", () => {
      it("handles JSON response correctly", async () => {
        expect.assertions(1);
        await ServiceTest(async ({ internal, context }) => {
          const jsonResponse = { key: "value" };
          // @ts-expect-error testing
          jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(JSON.stringify(jsonResponse)),
          });
          const response = await internal.boilerplate
            .fetch({
              baseUrl: "http://foo.bar",
              context,
            })
            .fetch({});
          expect(response).toEqual(jsonResponse);
        });
      });

      it("handles text response correctly", async () => {
        expect.assertions(1);
        await ServiceTest(async ({ internal, context }) => {
          const textResponse = "plain text";
          // @ts-expect-error testing
          jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(textResponse),
          });
          const response = await internal.boilerplate
            .fetch({ baseUrl: "http://foo.bar", context })
            .fetch({ process: "text" });
          expect(response).toBe(textResponse);
        });
      });

      it("handles raw response correctly", async () => {
        expect.assertions(1);
        await ServiceTest(async ({ internal, context }) => {
          const rawResponse = new Response("raw response");
          jest.spyOn(global, "fetch").mockResolvedValue(rawResponse);
          const response = await internal.boilerplate
            .fetch({ baseUrl: "http://foo.bar", context })
            .fetch({ process: "raw" });
          expect(response).toBe(rawResponse);
        });
      });

      it("handles HTTP errors correctly", async () => {
        expect.assertions(1);
        await ServiceTest(async ({ internal, context }) => {
          const errorResponse = {
            error: "Bad Request",
            message: "Invalid input",
            statusCode: 400,
          };
          // @ts-expect-error testing
          jest.spyOn(global, "fetch").mockResolvedValue({
            ok: false,
            text: jest.fn().mockResolvedValue(JSON.stringify(errorResponse)),
          });
          await expect(
            internal.boilerplate
              .fetch({
                baseUrl: "http://foo.bar",
                context,
              })
              .fetch({}),
          ).rejects.toThrow("Invalid input");
        });
      });
    });
  });
});
