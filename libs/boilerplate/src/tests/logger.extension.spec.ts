import { ZCC } from "@zcc/utilities";

import { ILogger } from "../extensions/logger.extension.mjs";

describe("Logger Extension", () => {
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
    beforeEach(() => {
      ZCC.logger.setBaseLogger(mockLogger);
    });

    LOG_LEVELS.forEach(level => {
      it(`should call through to the correct function for ${level}`, () => {
        ZCC.systemLogger[level]("Test message");
        expect(mockLogger[level]).toHaveBeenCalled();
      });
    });
  });

  // 4. Test each method receives context under standard logger
  describe("Context Reception in Standard Logger", () => {
    let mockLogger: ILogger;
    beforeEach(() => {
      mockLogger = createMockLogger();
      ZCC.logger.setBaseLogger(mockLogger);
    });

    it("should receive context in each log method", () => {
      const testContext = "testContext";
      LOG_LEVELS.forEach(level => {
        ZCC.logger.context(testContext)[level]("Test message");
        expect(mockLogger[level]).toHaveBeenCalledWith(
          expect.objectContaining({ context: testContext }),
        );
      });
    });
  });

  // Additional test opportunities (mention only):
  // - Test if the pretty logger correctly formats messages
  // - Test the behavior when maxCutoff is reached in prettyFormatMessage
  // - Test highlightContext function with different inputs
});
