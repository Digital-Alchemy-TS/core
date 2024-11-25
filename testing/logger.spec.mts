import chalk from "chalk";
import dayjs from "dayjs";

import {
  ApplicationDefinition,
  CreateLibrary,
  createMockLogger,
  OptionalModuleConfiguration,
  ServiceMap,
  TestRunner,
} from "../src/index.mts";

describe("Logger", () => {
  let application: ApplicationDefinition<ServiceMap, OptionalModuleConfiguration>;

  afterEach(async () => {
    if (application) {
      await application.teardown();
      application = undefined;
    }
    vi.restoreAllMocks();
  });

  // #MARK: configuration
  describe("Configuration Interactions", () => {
    it("calls the appropriate things based on permission combos", async () => {
      expect.assertions(1);

      const customLogger = createMockLogger();
      const spy = vi.spyOn(customLogger, "fatal");
      await TestRunner()
        .setOptions({ customLogger })
        .run(({ internal, logger }) => {
          internal.boilerplate.configuration.set("boilerplate", "LOG_LEVEL", "warn");
          logger.fatal("HIT");
          expect(spy).toHaveBeenCalled();
        });
    });

    it("updates onPostConfig", async () => {
      expect.assertions(1);

      await TestRunner().run(({ internal, lifecycle }) => {
        const spy = vi.spyOn(internal.boilerplate.logger, "updateShouldLog");
        lifecycle.onReady(() => {
          expect(spy).toHaveBeenCalled();
        });
      });
    });

    it("updates when LOG_LEVEL changes", async () => {
      expect.assertions(1);

      await TestRunner().run(({ internal }) => {
        const spy = vi.spyOn(internal.boilerplate.logger, "updateShouldLog");
        internal.boilerplate.configuration.set("boilerplate", "LOG_LEVEL", "warn");
        expect(spy).toHaveBeenCalled();
      });
    });

    describe("Level overrides", () => {
      it("allows module level overrides", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
        const spy = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});

        await TestRunner()
          .emitLogs("warn")
          .setOptions({
            loggerOptions: {
              levelOverrides: {
                // @ts-expect-error testing
                trace_library: "trace",
              },
            },
          })
          .appendLibrary(
            CreateLibrary({
              // @ts-expect-error testing
              name: "trace_library",
              services: {
                test({ logger }) {
                  spy.mockClear();
                  logger.trace("test");
                  expect(spy).toHaveBeenCalled();
                },
              },
            }),
          )
          .run(() => {});
      });

      it("allows service level overrides", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
        const spy = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});

        await TestRunner()
          .emitLogs("warn")
          .setOptions({
            loggerOptions: {
              levelOverrides: {
                // @ts-expect-error testing
                "trace_library:test": "trace",
              },
            },
          })
          .appendLibrary(
            CreateLibrary({
              // @ts-expect-error testing
              name: "trace_library",
              services: {
                second({ logger }) {
                  spy.mockClear();
                  logger.trace("test");
                  expect(spy).not.toHaveBeenCalled();
                },
                test({ logger }) {
                  spy.mockClear();
                  logger.trace("test");
                  expect(spy).toHaveBeenCalled();
                },
              },
            }),
          )
          .run(() => {});
      });
    });
  });

  // #MARK: pretty
  describe("Pretty Formatting", () => {
    const frontDash = " - ";
    let YELLOW_DASH: string;
    let BLUE_TICK: string;

    beforeAll(async () => {
      YELLOW_DASH = chalk.yellowBright(frontDash);
      BLUE_TICK = chalk.blue(`>`);
    });

    it("should default to pretty formatting", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        expect(internal.boilerplate.logger.getPrettyFormat()).toBe(true);
      });
    });

    it("should return the original message if it exceeds MAX_CUTOFF", async () => {
      expect.assertions(1);

      await TestRunner().run(({ internal: { boilerplate } }) => {
        const longMessage = "a".repeat(2001);
        expect(boilerplate.logger.prettyFormatMessage(longMessage)).toBe(longMessage);
      });
    });

    it('should highlight ">" in blue between square brackets', async () => {
      expect.assertions(1);

      await TestRunner().run(({ internal: { boilerplate } }) => {
        const message = "[A] > [B] > [C]";
        const expected = `${chalk.bold.magenta("A")} ${BLUE_TICK} ${chalk.bold.magenta("B")} ${BLUE_TICK} ${chalk.bold.magenta("C")}`;
        expect(boilerplate.logger.prettyFormatMessage(message)).toBe(expected);
      });
    });

    it("should strip brackets and highlight text in magenta", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal: { boilerplate } }) => {
        const message = "[Text]";
        const expected = chalk.bold.magenta("Text");
        expect(boilerplate.logger.prettyFormatMessage(message)).toBe(expected);
      });
    });

    it("should strip braces and highlight text in gray", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal: { boilerplate } }) => {
        const message = "{Text}";
        const expected = chalk.bold.gray("Text");
        expect(boilerplate.logger.prettyFormatMessage(message)).toBe(expected);
      });
    });

    it("should highlight dash at the start of the message in yellow", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal: { boilerplate } }) => {
        const message = " - Text";
        const expected = `${YELLOW_DASH}Text`;
        expect(boilerplate.logger.prettyFormatMessage(message)).toBe(expected);
      });
    });

    it("always provides strings back", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal: { boilerplate } }) => {
        expect(boilerplate.logger.prettyFormatMessage(undefined)).toBe("");
      });
    });

    it("passes through boot configs", async () => {
      expect.assertions(1);
      await TestRunner()
        .setOptions({
          loggerOptions: {
            pretty: true,
          },
        })
        .run(({ internal: { boilerplate } }) => {
          const testString = "{testing}";
          const result = boilerplate.logger.prettyFormatMessage(testString);
          expect(result).not.toBe(testString);
        });
    });

    it("passes through boot configs", async () => {
      expect.assertions(1);
      await TestRunner()
        .setOptions({
          loggerOptions: {
            pretty: false,
          },
        })
        .run(({ internal: { boilerplate } }) => {
          const testString = "{testing}";
          const result = boilerplate.logger.prettyFormatMessage(testString);
          expect(result).toBe(testString);
        });
    });
  });

  // #MARK: Details
  describe("Details", () => {
    it("provides access base logger", async () => {
      expect.assertions(1);
      const logger = createMockLogger();
      await TestRunner()
        .setOptions({ customLogger: logger })
        .run(({ internal }) => {
          expect(internal.boilerplate.logger.getBaseLogger()).toStrictEqual(logger);
        });
    });
    it("can modify base logger", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        const logger = createMockLogger();
        internal.boilerplate.logger.setBaseLogger(logger);
        expect(internal.boilerplate.logger.getBaseLogger()).toBe(logger);
      });
    });

    it("can modify pretty format", async () => {
      expect.assertions(1);
      await TestRunner().run(({ internal }) => {
        internal.boilerplate.logger.setPrettyFormat(false);
        expect(internal.boilerplate.logger.getPrettyFormat()).toBe(false);
      });
    });

    it("allows timestamp format to be configured", async () => {
      const format = "ddd HH:mm:ss";
      vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
      vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
      vi.spyOn(globalThis.console, "log").mockImplementation(() => {});

      await TestRunner()
        .setOptions({
          emitLogs: true,
          loggerOptions: { timestampFormat: format },
        })
        .run(({ logger }) => {
          const spy = vi.spyOn(dayjs.prototype, "format").mockImplementation(() => "timestamp");
          logger.info(`test`);
          expect(spy).toHaveBeenCalledWith(format);
        });
    });

    // #MARK: level matching
    describe("level matching", () => {
      it("warn uses error", async () => {
        const spy = vi.spyOn(globalThis.console, "warn").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
        await TestRunner()
          .emitLogs()
          .run(({ logger }) => {
            vi.clearAllMocks();
            logger.warn(`test`);
            expect(spy).toHaveBeenCalled();
          });
      });

      it("error uses error", async () => {
        const spy = vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
        await TestRunner()
          .emitLogs()
          .run(({ logger }) => {
            vi.clearAllMocks();
            logger.error(`test`);
            expect(spy).toHaveBeenCalled();
          });
      });

      it("fatal uses error", async () => {
        const spy = vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
        await TestRunner()
          .emitLogs()
          .run(({ logger }) => {
            vi.clearAllMocks();
            logger.fatal(`test`);
            expect(spy).toHaveBeenCalled();
          });
      });

      it("trace uses log", async () => {
        vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        const spy = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
        await TestRunner()
          .emitLogs()
          .run(({ logger }) => {
            vi.clearAllMocks();
            logger.trace(`test`);
            expect(spy).toHaveBeenCalled();
          });
      });

      it("trace uses debug", async () => {
        vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
        const spy = vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        await TestRunner()
          .emitLogs()
          .run(({ logger }) => {
            vi.clearAllMocks();
            logger.debug(`test`);
            expect(spy).toHaveBeenCalled();
          });
      });

      it("trace uses info", async () => {
        vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        const spy = vi.spyOn(globalThis.console, "log").mockImplementation(() => {});
        await TestRunner()
          .emitLogs()
          .run(({ logger }) => {
            vi.clearAllMocks();
            logger.info(`test`);
            expect(spy).toHaveBeenCalled();
          });
      });
    });

    // #MARK: logIdx
    describe.skip("logIdx", () => {
      it("can emit logIdx", async () => {
        expect.assertions(1);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        const spy = vi.fn();
        await TestRunner()
          .setOptions({ loggerOptions: { counter: true } })
          .emitLogs("info")
          .run(({ logger, internal }) => {
            // internal.boilerplate.logger.setHttpLogs("https://hello.world");
            vi.spyOn(globalThis, "fetch").mockImplementation((_, { body }) => {
              const data = JSON.parse(String(body));
              spy(data);
              return undefined;
            });
            logger.info("hello world");
          });

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            logIdx: expect.any(Number),
          }),
        );
      });

      it("does not emit logIdx by default", async () => {
        expect.assertions(1);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        const spy = vi.fn();
        await TestRunner()
          .emitLogs("info")
          .run(({ logger, internal }) => {
            // internal.boilerplate.logger.setHttpLogs("https://hello.world");
            vi.spyOn(globalThis, "fetch").mockImplementation((_, { body }) => {
              const data = JSON.parse(String(body));
              spy(data);
              return undefined;
            });
            logger.info("hello world");
          });

        expect(spy).not.toHaveBeenCalledWith(
          expect.objectContaining({
            logIdx: expect.any(Number),
          }),
        );
      });
    });

    // #MARK: ms
    describe.skip("ms", () => {
      it("can emit ms", async () => {
        expect.assertions(1);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        const spy = vi.fn();
        await TestRunner()
          .setOptions({ loggerOptions: { ms: true } })
          .emitLogs("info")
          .run(({ logger, internal }) => {
            // internal.boilerplate.logger.setHttpLogs("https://hello.world");
            vi.spyOn(globalThis, "fetch").mockImplementation((_, { body }) => {
              const data = JSON.parse(String(body));
              spy(data);
              return undefined;
            });
            logger.info("hello world");
          });

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            ms: expect.any(String),
          }),
        );
      });

      it("can emit ms in green", async () => {
        expect.assertions(1);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        const spy = vi.fn();
        await TestRunner()
          .setOptions({ loggerOptions: { ms: true } })
          .emitLogs("info")
          .run(({ logger, internal }) => {
            // internal.boilerplate.logger.setHttpLogs("https://hello.world");
            vi.spyOn(globalThis, "fetch").mockImplementation((_, { body }) => {
              const data = JSON.parse(String(body));
              spy(data);
              return undefined;
            });
            logger.info("hello world");
          });

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            ms: expect.stringMatching(/^\+[\d.]*ms$/),
          }),
        );
      });

      it("prepends ms number", async () => {
        expect.assertions(1);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        await TestRunner()
          .emitLogs("info")
          .setOptions({ loggerOptions: { ms: true, pretty: false } })
          .run(({ logger }) => {
            vi.clearAllMocks();
            logger.info("hello world");
            expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^\+[\d.]*ms/));
          });
      });

      it("does not emit ms by default", async () => {
        expect.assertions(1);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        const spy = vi.fn();
        await TestRunner()
          .emitLogs("info")
          .run(({ logger, internal }) => {
            // internal.boilerplate.logger.setHttpLogs("https://hello.world");
            vi.spyOn(globalThis, "fetch").mockImplementation((_, { body }) => {
              const data = JSON.parse(String(body));
              spy(data);
              return undefined;
            });
            logger.info("hello world");
          });

        expect(spy).not.toHaveBeenCalledWith(
          expect.objectContaining({
            ms: expect.any(String),
          }),
        );
      });
    });

    // #MARK: als
    describe.skip("als", () => {
      it("will merge als data if enabled", async () => {
        expect.assertions(1);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        const spy = vi.fn();
        await TestRunner()
          .setOptions({ loggerOptions: { als: true } })
          .emitLogs("info")
          .run(({ logger, internal, als }) => {
            // @ts-expect-error idc
            als.getLogData = () => {
              return {
                hit: true,
              };
            };
            // internal.boilerplate.logger.setHttpLogs("https://hello.world");
            vi.spyOn(globalThis, "fetch").mockImplementation((_, { body }) => {
              const data = JSON.parse(String(body));
              spy(data);
              return undefined;
            });
            logger.info("hello world");
          });

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            hit: true,
          }),
        );
      });

      it("does not merge als data if disabled", async () => {
        expect.assertions(1);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(globalThis.console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        const spy = vi.fn();
        await TestRunner()
          .emitLogs("info")
          .run(({ logger, internal, als }) => {
            // @ts-expect-error idc
            als.getLogData = () => {
              return {
                hit: true,
              };
            };
            // internal.boilerplate.logger.setHttpLogs("https://hello.world");
            vi.spyOn(globalThis, "fetch").mockImplementation((_, { body }) => {
              const data = JSON.parse(String(body));
              spy(data);
              return undefined;
            });
            logger.info("hello world");
          });

        expect(spy).not.toHaveBeenCalledWith(
          expect.objectContaining({
            hit: true,
          }),
        );
      });
    });
  });
});
