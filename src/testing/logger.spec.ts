// magic import, do not remove / put anything above
import "..";

import dayjs from "dayjs";

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
    const getChalk = async () => (await import("chalk")).default;
    let chalk: Awaited<ReturnType<typeof getChalk>>;
    const frontDash = " - ";
    let YELLOW_DASH: string;
    let BLUE_TICK: string;

    beforeAll(async () => {
      chalk = await getChalk();
      YELLOW_DASH = chalk.yellowBright(frontDash);
      BLUE_TICK = chalk.blue(`>`);
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

    it("should return the original message if it exceeds MAX_CUTOFF", () => {
      const longMessage = "a".repeat(2001);
      expect(
        params.internal.boilerplate.logger.prettyFormatMessage(longMessage),
      ).toBe(longMessage);
    });

    it("should highlight text with # in yellow", () => {
      const message = "partA#partB";
      const expected = chalk.yellow("partA#partB");
      expect(
        params.internal.boilerplate.logger.prettyFormatMessage(message),
      ).toBe(expected);
    });

    it('should highlight ">" in blue between square brackets', () => {
      const message = "[A] > [B] > [C]";
      const expected = `${chalk.bold.magenta("A")} ${BLUE_TICK} ${chalk.bold.magenta("B")} ${BLUE_TICK} ${chalk.bold.magenta("C")}`;
      expect(
        params.internal.boilerplate.logger.prettyFormatMessage(message),
      ).toBe(expected);
    });

    it("should strip brackets and highlight text in magenta", () => {
      const message = "[Text]";
      const expected = chalk.bold.magenta("Text");
      expect(
        params.internal.boilerplate.logger.prettyFormatMessage(message),
      ).toBe(expected);
    });

    it("should strip braces and highlight text in gray", () => {
      const message = "{Text}";
      const expected = chalk.bold.gray("Text");
      expect(
        params.internal.boilerplate.logger.prettyFormatMessage(message),
      ).toBe(expected);
    });

    it("should highlight dash at the start of the message in yellow", () => {
      const message = " - Text";
      const expected = `${YELLOW_DASH}Text`;
      expect(
        params.internal.boilerplate.logger.prettyFormatMessage(message),
      ).toBe(expected);
    });
  });

  describe("Fine Tuning", () => {
    it("allows timestamp format to be configured", async () => {
      const format = "ddd HH:mm:ss";
      application = CreateApplication({
        configurationLoaders: [],
        // @ts-expect-error For unit testing
        name: "testing",
        services: {
          Test({ logger }: TServiceParams) {
            jest.spyOn(console, "error").mockImplementation(() => {});
            jest.spyOn(console, "log").mockImplementation(() => {});
            const spy = jest
              .spyOn(dayjs.prototype, "format")
              .mockImplementation(() => "timestamp");
            logger.info(`test`);
            expect(spy).toHaveBeenCalledWith(format);
          },
        },
      });
      await application.bootstrap({
        // ...BASIC_BOOT,
        loggerOptions: { timestamp_format: format },
      });
    });
  });
});
