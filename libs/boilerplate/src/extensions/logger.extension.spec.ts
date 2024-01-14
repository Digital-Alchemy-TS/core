import { faker } from "@faker-js/faker";
import { ZCC } from "@zcc/utilities";
import chalk from "chalk";
import pino from "pino";

import { LOG_LEVEL } from "../helpers/config.constants.mjs";
import { bootTestingModule } from "../helpers/testing.helper.mjs";
import {
  highlightContext,
  ILogger,
  METHOD_COLORS,
  prettyFormatMessage,
} from "./logger.extension.mjs";

describe.skip("Logger Extension", () => {
  beforeAll(async () => {
    await bootTestingModule(
      {},
      { libs: { boilerplate: { [LOG_LEVEL]: "trace" } } },
    );
    // LIB_BOILERPLATE.lifecycle.register();
    // start from a known state
    ZCC.logger.setPrettyLogger(false);
  });
  const LOG_LEVELS = ["debug", "error", "fatal", "info", "trace", "warn"];
  let mockLogger: ILogger;
  let base: ILogger;

  function createMockLogger(): ILogger {
    const mock = {};
    LOG_LEVELS.forEach(method => {
      mock[method] = jest.fn();
    });
    return mock as ILogger;
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    base = ZCC.logger.getBaseLogger();
    ZCC.logger.setBaseLogger(mockLogger);
  });

  afterEach(() => {
    ZCC.logger.setBaseLogger(base);
  });

  it("should attach logger and systemLogger to ZCC", () => {
    expect(ZCC.logger).toBeDefined();
    expect(ZCC.systemLogger).toBeDefined();
  });

  // 3. Test main logger calls
  describe("Main Logger Calls", () => {
    LOG_LEVELS.forEach(level => {
      it(`should call through to the correct function for ${level}`, () => {
        ZCC.systemLogger[level]("Test message");
        expect(mockLogger[level]).toHaveBeenCalled();
      });
    });
  });

  describe("prettyFormatMessage", () => {
    const generateSafeString = () =>
      faker.lorem.words(2).replaceAll(/[#[\]{}]/g, ""); // Avoid characters that might be interpreted as control characters

    it("should handle empty string", () => {
      expect(prettyFormatMessage("")).toBe("");
    });

    it("should handle null", () => {
      expect(prettyFormatMessage(null)).toBe("");
    });

    it("should handle undefined", () => {
      expect(prettyFormatMessage(undefined)).toBe("");
    });

    it("should format item references correctly", () => {
      const text = generateSafeString();
      const input = `[${text}]`;
      const output = prettyFormatMessage(input);

      expect(output).toContain(chalk.bold.magenta(text));
    });

    it("should format extra info correctly", () => {
      const text = generateSafeString();
      const input = `{${text}}`;
      const output = prettyFormatMessage(input);
      expect(output).toContain(chalk.bold.gray(text));
    });

    it("should format lists correctly", () => {
      const text = generateSafeString();
      const input = ` - ${text}`;
      const output = prettyFormatMessage(input);
      expect(output).toContain(chalk.yellowBright(" - "));
    });

    it("should correctly highlight object references within a string", () => {
      const prefixText = generateSafeString();
      const suffixText = generateSafeString();
      const path = faker.lorem.word().replaceAll(/[#[\]{}]/g, "");
      const property = faker.lorem.word().replaceAll(/[#[\]{}]/g, "");
      const input = `${prefixText} ${path}#${property} ${suffixText}`;
      const output = prettyFormatMessage(input);

      const expectedHighlighted = chalk.yellow(`${path}#${property}`);
      const expectedOutput = `${prefixText} ${expectedHighlighted} ${suffixText}`;
      expect(output).toContain(expectedHighlighted);
      expect(output).toBe(expectedOutput);
    });

    it("should handle multiple formats in one message", () => {
      const text1 = generateSafeString();
      const text2 = generateSafeString();
      const text3 = generateSafeString();
      const input = ` - [${text1}] {${text2}} ${text3}`;
      const output = prettyFormatMessage(input);
      expect(output).toContain(chalk.bold.magenta(text1));
      expect(output).toContain(chalk.bold.gray(text2));
      expect(output).toContain(chalk.yellowBright(" - "));
    });
  });

  describe("Standard Logger", () => {
    beforeAll(() => {
      ZCC.logger.setPrettyLogger(false);
    });
    it("should receive context in each log method", () => {
      const testContext = faker.lorem.word();
      const message = faker.lorem.sentence();
      LOG_LEVELS.forEach(level => {
        ZCC.logger.context(testContext)[level](message);
        expect(mockLogger[level]).toHaveBeenCalledWith(
          expect.objectContaining({ context: testContext }),
          message,
        );
      });
    });
  });

  describe("highlightContext", () => {
    const testContext = "TestContext:Text";
    // beforeEach(() => {
    //   // Clear the cache before each test
    //   ZCC.logger.LOGGER_CACHE = {};
    // });

    Object.entries(METHOD_COLORS).forEach(([level, colorType]) => {
      it(`should correctly highlight context '${testContext}' as '${level}'`, () => {
        const expectedOutput = chalk`{bold.${colorType
          .slice(2)
          .toLowerCase()} [${testContext}]}`;
        const output = highlightContext(testContext, colorType);
        expect(output).toBe(expectedOutput);
      });
    });

    it("should cache highlighted context", () => {
      const level = "info";
      const colorType = METHOD_COLORS.get(level);
      highlightContext(testContext, colorType);
      const cache = ZCC.logger.LOGGER_CACHE();

      expect(cache).toHaveProperty(testContext + colorType);

      const cachedOutput = cache[testContext + colorType];
      expect(cachedOutput).toBeDefined();
      expect(cachedOutput).toBe(highlightContext(testContext, colorType)); // Cached value should match new call
    });
  });

  describe("Logger Level Priority", () => {
    const testLogLevelPriority = (
      setLevel: pino.Level,
      expectedToLog: pino.Level[],
      expectedNotToLog: pino.Level[],
    ) => {
      describe(`when log level is set to ${setLevel}`, () => {
        beforeEach(() => {
          ZCC.logger.setLogLevel(setLevel);
        });

        expectedToLog.forEach(level => {
          it(`should log ${level} level messages`, () => {
            ZCC.systemLogger[level]("Test message");
            expect(mockLogger[level]).toHaveBeenCalled();
          });
        });

        expectedNotToLog.forEach(level => {
          it(`should not log ${level} level messages`, () => {
            ZCC.systemLogger[level]("Test message");
            expect(mockLogger[level]).not.toHaveBeenCalled();
          });
        });
      });
    };

    // When the set log level is 'trace'
    testLogLevelPriority(
      "trace",
      ["trace", "debug", "info", "warn", "error", "fatal"],
      [],
    );

    // When the set log level is 'debug'
    testLogLevelPriority(
      "debug",
      ["debug", "info", "warn", "error", "fatal"],
      ["trace"],
    );

    // When the set log level is 'info'
    testLogLevelPriority(
      "info",
      ["info", "warn", "error", "fatal"],
      ["trace", "debug"],
    );

    // When the set log level is 'warn'
    testLogLevelPriority(
      "warn",
      ["warn", "error", "fatal"],
      ["trace", "debug", "info"],
    );

    // When the set log level is 'error'
    testLogLevelPriority(
      "error",
      ["error", "fatal"],
      ["trace", "debug", "info", "warn"],
    );

    // When the set log level is 'fatal'
    testLogLevelPriority(
      "fatal",
      ["fatal"],
      ["trace", "debug", "info", "warn", "error"],
    );
  });
});
