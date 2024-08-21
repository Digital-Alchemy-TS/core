/* eslint-disable unicorn/escape-case */
/* eslint-disable unicorn/no-hex-escape */
// magic import, do not remove / put anything above
import "..";

import { CreateApplication, is } from "../extensions";
import {
  ApplicationDefinition,
  BootstrapOptions,
  OptionalModuleConfiguration,
  ServiceMap,
  TServiceParams,
} from "../helpers";

const BASIC_BOOT = {
  configuration: {
    boilerplate: { LOG_LEVEL: "silent" },
  },
} as BootstrapOptions;

describe("Logger", () => {
  let application: ApplicationDefinition<
    ServiceMap,
    OptionalModuleConfiguration
  >;

  afterEach(async () => {
    if (application) {
      await application.teardown();
      application = undefined;
    }
    jest.restoreAllMocks();
  });

  describe("Configuration Interactions", () => {
    it("can log stuff by default", async () => {
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          Test({ internal }: TServiceParams) {
            expect(is.empty(internal.boilerplate.logger.getShouldILog())).toBe(
              false,
            );
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
    });

    it("updates onPostConfig", async () => {
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          Test({ internal, lifecycle }: TServiceParams) {
            const spy = jest.spyOn(
              internal.boilerplate.logger,
              "updateShouldLog",
            );
            lifecycle.onReady(() => {
              expect(spy).toHaveBeenCalled();
            });
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
    });

    it("updates when LOG_LEVEL changes", async () => {
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          Test({ internal }: TServiceParams) {
            const spy = jest.spyOn(
              internal.boilerplate.logger,
              "updateShouldLog",
            );
            internal.boilerplate.configuration.set(
              "boilerplate",
              "LOG_LEVEL",
              "warn",
            );
            expect(spy).toHaveBeenCalled();
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
    });
  });

  describe("Pretty Formatting", () => {
    let params: TServiceParams;

    beforeAll(async () => {
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "test",
        services: {
          Test(serviceParams: TServiceParams) {
            params = serviceParams;
          },
        },
      });
      await application.bootstrap(BASIC_BOOT);
    });
    it("should return an empty string if message is empty", () => {
      expect(params.internal.boilerplate.logger.prettyFormatMessage("")).toBe(
        "",
      );
    });

    it("should return the original message if it exceeds MAX_CUTOFF", () => {
      const longMessage = "a".repeat(2001);
      expect(
        params.internal.boilerplate.logger.prettyFormatMessage(longMessage),
      ).toBe(longMessage);
    });

    it("should highlight text with # in yellow", () => {
      const message = "partA#partB";
      const expected = "\x1B[33mpartA#partB\x1B[39m";
      const target =
        params.internal.boilerplate.logger.prettyFormatMessage(message);
      expect(target).toBe(expected);
    });

    it('should highlight ">" in blue between square brackets', () => {
      const message = "[A] > [B] > [C]";
      const expected =
        "\x1B[1m\x1B[35mA\x1B[39m\x1B[22m \x1B[34m>\x1B[39m \x1B[1m\x1B[35mB\x1B[39m\x1B[22m \x1B[34m>\x1B[39m \x1B[1m\x1B[35mC\x1B[39m\x1B[22m";
      const target =
        params.internal.boilerplate.logger.prettyFormatMessage(message);
      expect(target).toBe(expected);
    });

    it("should strip brackets and highlight text in magenta", () => {
      const message = "[Text]";
      const expected = "\x1B[1m\x1B[35mText\x1B[39m\x1B[22m";
      const target =
        params.internal.boilerplate.logger.prettyFormatMessage(message);
      expect(target).toBe(expected);
    });

    it("should strip braces and highlight text in gray", () => {
      const message = "{Text}";
      const expected = "\x1B[1m\x1B[90mText\x1B[39m\x1B[22m";
      const target =
        params.internal.boilerplate.logger.prettyFormatMessage(message);
      expect(target).toBe(expected);
    });

    it("should highlight dash at the start of the message in yellow", () => {
      const message = " - Text";
      expect(
        params.internal.boilerplate.logger.prettyFormatMessage(message),
      ).toBe("\x1B[93m - \x1B[39mText");
    });
  });
});
